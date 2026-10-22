#!/usr/bin/env python3
"""
PrintF Agent - Windows Print Job Processor

This agent polls for print jobs from Supabase and executes them
using the Windows printing subsystem.
"""

import os
import sys
import json
import time
import logging
import tempfile
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List

import httpx
from supabase import create_client, Client

# Windows-specific imports
if sys.platform == 'win32':
    import win32api
    import win32print
    import win32con

# Configure logging
def setup_logging(log_level: str = "INFO"):
    """Setup logging configuration."""
    log_file = Path(__file__).parent / "printf_agent.log"
    
    logging.basicConfig(
        level=getattr(logging, log_level.upper(), logging.INFO),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger("PrintFAgent")


class PrintFAgent:
    """Main PrintF Agent class for handling print jobs."""
    
    def __init__(self, config_path: str = "config.json"):
        """Initialize the PrintF Agent."""
        self.config = self._load_config(config_path)
        self.logger = setup_logging(self.config.get("log_level", "INFO"))
        
        self.printf_id = self.config["printf_id"]
        self.api_key = self.config["api_key"]
        self.printer_name = self.config.get("printer_name", "")
        self.poll_interval = self.config.get("poll_interval", 5)
        self.download_path = Path(self.config.get("download_path", "./downloads"))
        
        # Create download directory
        self.download_path.mkdir(parents=True, exist_ok=True)
        
        # Initialize Supabase client
        self.supabase: Client = create_client(
            self.config["supabase_url"],
            self.config["supabase_anon_key"]
        )
        
        self.running = False
        self.logger.info(f"PrintF Agent initialized for PrintF: {self.printf_id}")
    
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from JSON file."""
        config_file = Path(__file__).parent / config_path
        
        if not config_file.exists():
            raise FileNotFoundError(
                f"Configuration file not found: {config_file}\n"
                "Please copy config.example.json to config.json and update it."
            )
        
        with open(config_file, 'r') as f:
            return json.load(f)
    
    def authenticate(self) -> bool:
        """Verify PrintF API key with database."""
        try:
            response = self.supabase.table("printfs").select("id, name, api_key").eq(
                "id", self.printf_id
            ).single().execute()
            
            if response.data:
                if response.data.get("api_key") == self.api_key:
                    self.logger.info(f"Authenticated as: {response.data.get('name')}")
                    return True
                else:
                    self.logger.error("API key mismatch")
                    return False
            else:
                self.logger.error(f"PrintF not found: {self.printf_id}")
                return False
                
        except Exception as e:
            self.logger.error(f"Authentication failed: {e}")
            return False
    
    def update_status(self, status: str = "online"):
        """Update PrintF status and last_seen timestamp."""
        try:
            self.supabase.table("printfs").update({
                "status": status,
                "last_seen": datetime.utcnow().isoformat()
            }).eq("id", self.printf_id).execute()
            
            self.logger.debug(f"Status updated: {status}")
        except Exception as e:
            self.logger.error(f"Failed to update status: {e}")
    
    def update_supplies(self, paper_level: int = None, ink_level: int = None):
        """Update printer supply levels."""
        try:
            update_data = {}
            if paper_level is not None:
                update_data["paper_level"] = paper_level
            if ink_level is not None:
                update_data["ink_level"] = ink_level
            
            if update_data:
                self.supabase.table("printfs").update(update_data).eq(
                    "id", self.printf_id
                ).execute()
                self.logger.debug(f"Supplies updated: {update_data}")
        except Exception as e:
            self.logger.error(f"Failed to update supplies: {e}")
    
    def poll_jobs(self) -> List[Dict[str, Any]]:
        """Poll for pending print jobs."""
        try:
            self.logger.debug(f"Polling for jobs for PrintF: {self.printf_id}")
            
            response = self.supabase.table("print_jobs").select(
                "*"
            ).eq(
                "printf_id", self.printf_id
            ).eq(
                "status", "ready"
            ).eq(
                "locked", False
            ).order(
                "created_at"
            ).execute()
            
            jobs = response.data or []
            if len(jobs) > 0:
                self.logger.info(f"Found {len(jobs)} pending job(s)")
            
            # Check for mismatched jobs (debug only)
            if len(jobs) == 0:
                # Optional: Check if any ready jobs exist for OTHER printers to debug config
                pass
                
            return jobs
        except Exception as e:
            self.logger.error(f"Failed to poll jobs: {e}")
            return []
    
    def lock_job(self, job_id: str) -> bool:
        """Lock a job to prevent concurrent processing."""
        try:
            response = self.supabase.table("print_jobs").update({
                "locked": True,
                "status": "printing"
            }).eq("id", job_id).eq("locked", False).execute()
            
            return len(response.data) > 0 if response.data else False
        except Exception as e:
            self.logger.error(f"Failed to lock job {job_id}: {e}")
            return False
    
    def update_job_status(self, job_id: str, status: str):
        """Update job status."""
        try:
            self.supabase.table("print_jobs").update({
                "status": status,
                "locked": False
            }).eq("id", job_id).execute()
            
            self.logger.info(f"Job {job_id} status updated to: {status}")
        except Exception as e:
            self.logger.error(f"Failed to update job status: {e}")
    
    def log_event(self, message: str, log_type: str = "info", job_id: str = None, metadata: dict = None):
        """Log an event to the database."""
        try:
            self.supabase.table("logs").insert({
                "type": log_type,
                "message": message,
                "printf_id": self.printf_id,
                "job_id": job_id,
                "metadata": metadata or {}
            }).execute()
        except Exception as e:
            self.logger.error(f"Failed to log event: {e}")
    
    def download_file(self, file_path: str, job_id: str) -> Optional[Path]:
        """Download file from Supabase Storage."""
        try:
            # Expected file_path: jobs/filename.pdf
            # Bucket is always 'print-files' based on schema
            bucket = "print-files"
            object_path = file_path
            
            self.logger.info(f"Downloading: {bucket}/{object_path}")
            
            # Download file
            response = self.supabase.storage.from_(bucket).download(object_path)
            
            if response:
                # Save to local file
                filename = Path(object_path).name
                local_path = self.download_path / f"{job_id}_{filename}"
                
                with open(local_path, 'wb') as f:
                    f.write(response)
                
                self.logger.info(f"Downloaded to: {local_path}")
                return local_path
            else:
                self.logger.error(f"Empty response downloading file")
                return None
                
        except Exception as e:
            self.logger.error(f"Failed to download file: {e}")
            return None
    
    def get_default_printer(self) -> str:
        """Get the default Windows printer name."""
        if sys.platform != 'win32':
            return ""
        
        try:
            return win32print.GetDefaultPrinter()
        except Exception as e:
            self.logger.error(f"Failed to get default printer: {e}")
            return ""
    
    def list_printers(self) -> List[str]:
        """List available printers."""
        if sys.platform != 'win32':
            return []
        
        try:
            printers = win32print.EnumPrinters(
                win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
            )
            return [p[2] for p in printers]
        except Exception as e:
            self.logger.error(f"Failed to list printers: {e}")
            return []
    
    def print_file(self, file_path: Path, settings: Dict[str, Any]) -> bool:
        """Print a file using Windows printing."""
        if sys.platform != 'win32':
            self.logger.error("Printing is only supported on Windows")
            return False
        
        try:
            printer_name = self.printer_name or self.get_default_printer()
            
            if not printer_name:
                self.logger.error("No printer available")
                return False
            
            self.logger.info(f"Printing to: {printer_name}")
            
            # Get print settings
            copies = settings.get("copies", 1)
            color = settings.get("color", False)
            duplex = settings.get("duplex", False)
            
            file_extension = file_path.suffix.lower()
            
            if file_extension == ".pdf":
                return self._print_pdf(file_path, printer_name, copies, color, duplex)
            elif file_extension in [".jpg", ".jpeg", ".png", ".bmp", ".gif"]:
                return self._print_image(file_path, printer_name, copies)
            elif file_extension in [".doc", ".docx"]:
                return self._print_office_doc(file_path, printer_name, copies)
            else:
                # Try to print as raw text
                return self._print_raw(file_path, printer_name, copies)
                
        except Exception as e:
            self.logger.error(f"Print failed: {e}")
            return False
    
    def _print_pdf(self, file_path: Path, printer_name: str, copies: int, color: bool, duplex: bool) -> bool:
        """Print PDF file using SumatraPDF or Adobe Reader."""
        try:
            # Try SumatraPDF first (silent printing)
            sumatra_paths = [
                r"C:\Program Files\SumatraPDF\SumatraPDF.exe",
                r"C:\Program Files (x86)\SumatraPDF\SumatraPDF.exe",
                os.path.expanduser("~\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe"),
            ]
            
            sumatra_exe = None
            for path in sumatra_paths:
                if os.path.exists(path):
                    sumatra_exe = path
                    break
            
            if sumatra_exe:
                # SumatraPDF silent print command
                cmd = [
                    sumatra_exe,
                    "-print-to", printer_name,
                    "-print-settings", f"{copies}x",
                    "-silent",
                    str(file_path)
                ]
                
                if duplex:
                    cmd[4] = f"{copies}x,duplex"
                
                self.logger.info(f"Running: {' '.join(cmd)}")
                result = subprocess.run(cmd, capture_output=True, timeout=120)
                
                if result.returncode == 0:
                    self.logger.info("PDF printed successfully via SumatraPDF")
                    return True
                else:
                    self.logger.warning(f"SumatraPDF exit code: {result.returncode}")
            
            # Fallback: Use Windows shell print
            self.logger.info("Using Windows shell print for PDF")
            for _ in range(copies):
                win32api.ShellExecute(
                    0,
                    "print",
                    str(file_path),
                    f'/d:"{printer_name}"',
                    ".",
                    0
                )
                time.sleep(2)  # Wait between copies
            
            return True
            
        except subprocess.TimeoutExpired:
            self.logger.error("PDF print timed out")
            return False
        except Exception as e:
            self.logger.error(f"PDF print failed: {e}")
            return False
    
    def _print_image(self, file_path: Path, printer_name: str, copies: int) -> bool:
        """Print image file."""
        try:
            from PIL import Image
            import win32ui
            import win32con
            
            # Open image
            img = Image.open(file_path)
            
            # Get printer DC
            hdc = win32ui.CreateDC()
            hdc.CreatePrinterDC(printer_name)
            
            for _ in range(copies):
                hdc.StartDoc(str(file_path))
                hdc.StartPage()
                
                # Calculate scaling
                printable_area = hdc.GetDeviceCaps(win32con.HORZRES), hdc.GetDeviceCaps(win32con.VERTRES)
                printer_size = hdc.GetDeviceCaps(win32con.PHYSICALWIDTH), hdc.GetDeviceCaps(win32con.PHYSICALHEIGHT)
                
                # Scale image to fit
                ratio = min(printable_area[0] / img.width, printable_area[1] / img.height)
                new_size = (int(img.width * ratio), int(img.height * ratio))
                
                img_resized = img.resize(new_size, Image.Resampling.LANCZOS)
                
                # Convert to DIB and print
                dib = Image.new('RGB', new_size)
                dib.paste(img_resized)
                dib_bytes = dib.tobytes()
                
                hdc.EndPage()
                hdc.EndDoc()
            
            hdc.DeleteDC()
            self.logger.info("Image printed successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Image print failed: {e}")
            # Fallback to shell print
            try:
                for _ in range(copies):
                    win32api.ShellExecute(0, "print", str(file_path), None, ".", 0)
                    time.sleep(2)
                return True
            except:
                return False
    
    def _print_office_doc(self, file_path: Path, printer_name: str, copies: int) -> bool:
        """Print Office document using COM automation or shell."""
        try:
            # Use shell print as it's more reliable
            for _ in range(copies):
                win32api.ShellExecute(
                    0,
                    "print",
                    str(file_path),
                    f'/d:"{printer_name}"',
                    ".",
                    0
                )
                time.sleep(3)  # Wait between copies
            
            self.logger.info("Office document sent to printer")
            return True
            
        except Exception as e:
            self.logger.error(f"Office document print failed: {e}")
            return False
    
    def _print_raw(self, file_path: Path, printer_name: str, copies: int) -> bool:
        """Print raw text file."""
        try:
            for _ in range(copies):
                win32api.ShellExecute(
                    0,
                    "print",
                    str(file_path),
                    f'/d:"{printer_name}"',
                    ".",
                    0
                )
                time.sleep(1)
            
            return True
        except Exception as e:
            self.logger.error(f"Raw print failed: {e}")
            return False
    
    def cleanup_file(self, file_path: Path):
        """Delete temporary file after printing."""
        try:
            if file_path.exists():
                file_path.unlink()
                self.logger.debug(f"Cleaned up: {file_path}")
        except Exception as e:
            self.logger.warning(f"Failed to cleanup file: {e}")
    
    def process_job(self, job: Dict[str, Any]):
        """Process a single print job."""
        job_id = job["id"]
        file_path = job["file_path"]
        file_name = job["file_name"]
        settings = job.get("settings_json", {})
        
        self.logger.info(f"Processing job: {job_id} - {file_name}")
        
        # Lock the job
        if not self.lock_job(job_id):
            self.logger.warning(f"Could not lock job {job_id}, skipping")
            return
        
        self.log_event(f"Started printing: {file_name}", "info", job_id)
        
        # Download file
        local_file = self.download_file(file_path, job_id)
        
        if not local_file:
            self.update_job_status(job_id, "failed")
            self.log_event(f"Failed to download file: {file_name}", "error", job_id)
            return
        
        # Print file
        success = self.print_file(local_file, settings)
        
        if success:
            self.update_job_status(job_id, "completed")
            self.log_event(f"Completed printing: {file_name}", "success", job_id, {
                "copies": settings.get("copies", 1),
                "color": settings.get("color", False)
            })
        else:
            self.update_job_status(job_id, "failed")
            self.log_event(f"Print failed: {file_name}", "error", job_id)
        
        # Cleanup
        self.cleanup_file(local_file)
    
    def run(self):
        """Main agent loop."""
        self.logger.info("Starting PrintF Agent...")
        
        # Authenticate
        if not self.authenticate():
            self.logger.error("Authentication failed. Exiting.")
            return
        
        self.running = True
        self.update_status("online")
        
        # List available printers
        printers = self.list_printers()
        self.logger.info(f"Available printers: {printers}")
        
        default_printer = self.get_default_printer()
        self.logger.info(f"Default printer: {default_printer}")
        
        self.log_event("PrintF Agent started", "info")
        
        try:
            while self.running:
                # Update heartbeat
                self.update_status("online")
                
                # Poll for jobs
                jobs = self.poll_jobs()
                
                if jobs:
                    self.logger.info(f"Found {len(jobs)} pending job(s)")
                    
                    for job in jobs:
                        self.process_job(job)
                
                # Wait before next poll
                time.sleep(self.poll_interval)
                
        except KeyboardInterrupt:
            self.logger.info("Received shutdown signal")
        except Exception as e:
            self.logger.error(f"Agent error: {e}")
        finally:
            self.running = False
            self.update_status("offline")
            self.log_event("PrintF Agent stopped", "info")
            self.logger.info("PrintF Agent stopped")
    
    def stop(self):
        """Stop the agent."""
        self.running = False


def main():
    """Main entry point."""
    print("=" * 50)
    print("  PrintF Agent for Windows")
    print("=" * 50)
    print()
    
    try:
        agent = PrintFAgent()
        agent.run()
    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
