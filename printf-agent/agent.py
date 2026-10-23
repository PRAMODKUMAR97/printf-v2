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
    
    def _edge_call(self, action: str, **payload) -> Optional[Dict[str, Any]]:
        """Call the authenticated PrintF v2 printer-agent Edge Function."""
        try:
            base_url = self.config["supabase_url"].rstrip("/")
            publishable_key = self.config["supabase_anon_key"]
            response = httpx.post(
                f"{base_url}/functions/v1/printer-agent",
                headers={
                    "apikey": publishable_key,
                    "Authorization": f"Bearer {publishable_key}",
                    "Content-Type": "application/json",
                    "x-printf-id": self.printf_id,
                    "x-api-key": self.api_key,
                },
                json={"action": action, **payload},
                timeout=30.0,
            )
            response.raise_for_status()
            body = response.json()
            if not isinstance(body, dict):
                self.logger.error("Printer-agent endpoint returned an unexpected response")
                return None
            if body.get("error"):
                self.logger.warning("Printer-agent %s rejected request: %s", action, body.get("error"))
                return None
            return body
        except httpx.HTTPStatusError as exc:
            self.logger.warning(
                "Printer-agent %s HTTP status %s", action, exc.response.status_code
            )
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            self.logger.warning("Printer-agent %s request failed: %s", action, exc)
        except Exception as exc:
            self.logger.exception("Unexpected printer-agent %s error: %s", action, exc)
        return None

    def authenticate(self) -> bool:
        """Authenticate this station through the PrintF v2 Edge Function."""
        result = self._edge_call("authenticate")
        if result and result.get("success") and result.get("station", {}).get("id") == self.printf_id:
            self.logger.info("Authenticated with PrintF v2 printer-agent API")
            return True
        self.logger.error("PrintF station authentication failed; retrying")
        return False

    def update_status(self, status: str = "online"):
        """Send an authenticated heartbeat to the printer-agent Edge Function."""
        self._edge_call("heartbeat", status=status)

    def update_supplies(self, paper_level: int = None, ink_level: int = None):
        """Report printer supply levels through an authenticated heartbeat."""
        payload = {"status": "online"}
        if paper_level is not None:
            payload["paper_level"] = max(0, min(100, int(paper_level)))
        if ink_level is not None:
            payload["ink_level"] = max(0, min(100, int(ink_level)))
        self._edge_call("heartbeat", **payload)

    def poll_jobs(self) -> List[Dict[str, Any]]:
        """Poll for ready jobs using the authenticated PrintF v2 printer-agent API."""
        result = self._edge_call("poll")
        jobs = result.get("jobs", []) if result else []
        if not isinstance(jobs, list):
            self.logger.warning("Printer-agent returned an invalid jobs list")
            return []
        if jobs:
            self.logger.info("Found %s ready print job(s)", len(jobs))
        return jobs

    def lock_job(self, job_id: str) -> bool:
        """Atomically lock a ready job for this station."""
        result = self._edge_call("lock", job_id=job_id)
        return bool(result and result.get("locked"))

    def update_job_status(self, job_id: str, status: str):
        """Update this station's assigned job through the Edge Function."""
        result = self._edge_call("update_job", job_id=job_id, status=status)
        if result and result.get("success"):
            self.logger.info("Job %s status updated to %s", job_id, status)
        else:
            self.logger.error("Failed to update job %s status to %s", job_id, status)

    def log_event(self, message: str, log_type: str = "info", job_id: str = None, metadata: dict = None):
        """Write an agent event through the authenticated printer-agent API."""
        payload = {"message": str(message)[:500], "type": log_type}
        if job_id:
            payload["job_id"] = job_id
        if metadata:
            payload["metadata"] = metadata
        self._edge_call("log", **payload)

    def download_file(self, file_path: str, job_id: str) -> Optional[Path]:
        """Download a short-lived signed URL issued for this station's assigned job."""
        try:
            result = self._edge_call("file_url", job_id=job_id)
            signed_url = result.get("signed_url") if result else None
            if not signed_url:
                self.logger.error("No authorized download URL returned for job %s", job_id)
                return None
            response = httpx.get(signed_url, timeout=120.0, follow_redirects=True)
            response.raise_for_status()
            content_length = len(response.content)
            if content_length == 0 or content_length > 50 * 1024 * 1024:
                self.logger.error("Downloaded file has an invalid size: %s bytes", content_length)
                return None
            filename = Path(file_path).name
            local_path = self.download_path / f"{job_id}_{filename}"
            local_path.write_bytes(response.content)
            self.logger.info("Downloaded authorized job file to %s", local_path)
            return local_path
        except Exception as exc:
            self.logger.error("Failed to download job file %s: %s", job_id, exc)
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
                self._current_print_settings = dict(settings)
                try:
                    return self._print_pdf(file_path, printer_name, copies, color, duplex)
                finally:
                    self._current_print_settings = {}
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
    
    def _prepare_nup_pdf(self, file_path: Path, settings: Dict[str, Any]) -> Optional[Path]:
        """Create an A4 PDF with 2-up or 4-up layout while preserving selected page order."""
        try:
            import fitz  # PyMuPDF
            source = fitz.open(str(file_path))
            try:
                if source.page_count < 1:
                    return None

                raw_range = str(settings.get("page_range", "") or "").strip()
                page_indexes = set()
                if raw_range:
                    for part in raw_range.split(","):
                        match = __import__("re").fullmatch(r"\s*(\d+)\s*(?:-\s*(\d+))?\s*", part)
                        if not match:
                            continue
                        start_page = int(match.group(1))
                        end_page = int(match.group(2) or match.group(1))
                        for page_number in range(min(start_page, end_page), max(start_page, end_page) + 1):
                            if 1 <= page_number <= source.page_count:
                                page_indexes.add(page_number - 1)
                indexes = sorted(page_indexes) if page_indexes else list(range(source.page_count))

                layout = int(settings.get("layout", 1) or 1)
                if layout not in (2, 4):
                    return None
                columns = 2
                rows = 1 if layout == 2 else 2
                page_width, page_height = 595.0, 842.0  # A4, points
                margin, gap = 18.0, 12.0
                cell_width = (page_width - 2 * margin - (columns - 1) * gap) / columns
                cell_height = (page_height - 2 * margin - (rows - 1) * gap) / rows
                output = fitz.open()
                try:
                    for offset in range(0, len(indexes), layout):
                        target = output.new_page(width=page_width, height=page_height)
                        for slot, source_index in enumerate(indexes[offset:offset + layout]):
                            column = slot % columns
                            row = slot // columns
                            x0 = margin + column * (cell_width + gap)
                            y0 = margin + row * (cell_height + gap)
                            rect = fitz.Rect(x0, y0, x0 + cell_width, y0 + cell_height)
                            target.show_pdf_page(rect, source, source_index, keep_proportion=True, overlay=True)
                    fd, temp_name = tempfile.mkstemp(prefix="printf_nup_", suffix=".pdf", dir=str(self.download_path))
                    os.close(fd)
                    output.save(temp_name, garbage=3, deflate=True)
                    return Path(temp_name)
                finally:
                    output.close()
            finally:
                source.close()
        except Exception as exc:
            self.logger.error("Could not prepare the requested multi-page layout: %s", exc)
            return None

    def _print_pdf(self, file_path: Path, printer_name: str, copies: int, color: bool, duplex: bool) -> bool:
        """Print PDF with page range, A4 fitting, colour, duplex, copies, and N-up layout."""
        prepared_pdf = None
        try:
            sumatra_paths = [
                r"C:\\Program Files\\SumatraPDF\\SumatraPDF.exe",
                r"C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe",
                os.path.expanduser("~\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe"),
            ]
            sumatra_exe = next((path for path in sumatra_paths if os.path.exists(path)), None)
            settings = self._current_print_settings if hasattr(self, "_current_print_settings") else {}
            # _print_pdf is also callable independently; prefer the settings passed to the caller.
            layout = int(settings.get("layout", 1) or 1)
            page_range = str(settings.get("page_range", "") or "").strip().replace(" ", "")

            print_path = file_path
            print_settings = [f"{max(1, min(50, int(copies)))}x"]
            if layout in (2, 4):
                prepared_pdf = self._prepare_nup_pdf(file_path, settings)
                if prepared_pdf is None:
                    return False
                print_path = prepared_pdf
            elif page_range:
                print_settings.append(page_range)

            print_settings.extend([
                "color" if color else "monochrome",
                "duplexlong" if duplex else "simplex",
                "paper=A4",
            ])
            if settings.get("fit_to_page", True):
                print_settings.append("fit")

            if sumatra_exe:
                cmd = [
                    sumatra_exe, "-print-to", printer_name,
                    "-print-settings", ",".join(print_settings),
                    "-silent", str(print_path),
                ]
                self.logger.info("Printing PDF with SumatraPDF (%s)", ",".join(print_settings))
                result = subprocess.run(cmd, capture_output=True, timeout=180)
                if result.returncode == 0:
                    self.logger.info("PDF sent to printer successfully")
                    return True
                self.logger.error("SumatraPDF failed with exit code %s: %s", result.returncode, result.stderr.decode("utf-8", "replace")[:500])
                return False

            self.logger.warning("SumatraPDF is not installed; Windows shell printing may ignore print settings.")
            for _ in range(max(1, min(50, int(copies)))):
                result = win32api.ShellExecute(0, "print", str(print_path), f'/d:"{printer_name}"', ".", 0)
                if isinstance(result, int) and result <= 32:
                    self.logger.error("Windows shell could not send the PDF to the printer (code %s)", result)
                    return False
                time.sleep(3)
            return True
        except subprocess.TimeoutExpired:
            self.logger.error("PDF print timed out")
            return False
        except Exception as e:
            self.logger.error("PDF print failed: %s", e)
            return False
        finally:
            if prepared_pdf is not None:
                try:
                    prepared_pdf.unlink(missing_ok=True)
                except Exception as e:
                    self.logger.warning("Could not clean temporary layout PDF: %s", e)

    def _print_image(self, file_path: Path, printer_name: str, copies: int) -> bool:
        """Print a centered, scaled image through the Windows printer DC."""
        hdc = None
        try:
            from PIL import Image, ImageOps, ImageWin
            import win32ui
            import win32con

            with Image.open(file_path) as opened:
                img = ImageOps.exif_transpose(opened).convert("RGB")

            hdc = win32ui.CreateDC()
            hdc.CreatePrinterDC(printer_name)
            printable_width = int(hdc.GetDeviceCaps(win32con.HORZRES))
            printable_height = int(hdc.GetDeviceCaps(win32con.VERTRES))
            offset_x = int(hdc.GetDeviceCaps(win32con.PHYSICALOFFSETX))
            offset_y = int(hdc.GetDeviceCaps(win32con.PHYSICALOFFSETY))
            if printable_width <= 0 or printable_height <= 0:
                raise RuntimeError("The printer reported an invalid printable area")

            ratio = min(printable_width / img.width, printable_height / img.height)
            target_size = (max(1, int(img.width * ratio)), max(1, int(img.height * ratio)))
            resized = img.resize(target_size, Image.Resampling.LANCZOS)
            dib = ImageWin.Dib(resized)
            left = offset_x + max(0, (printable_width - target_size[0]) // 2)
            top = offset_y + max(0, (printable_height - target_size[1]) // 2)
            rect = (left, top, left + target_size[0], top + target_size[1])

            for _ in range(max(1, min(50, int(copies)))):
                hdc.StartDoc(str(file_path))
                page_started = False
                try:
                    hdc.StartPage()
                    page_started = True
                    dib.draw(hdc.GetHandleOutput(), rect)
                    hdc.EndPage()
                    page_started = False
                    hdc.EndDoc()
                except Exception:
                    if page_started:
                        try:
                            hdc.EndPage()
                        except Exception:
                            pass
                    try:
                        hdc.AbortDoc()
                    except Exception:
                        pass
                    raise

            self.logger.info("Image printed successfully")
            return True
        except Exception as e:
            self.logger.error("Image print failed: %s", e)
            return False
        finally:
            if hdc is not None:
                try:
                    hdc.DeleteDC()
                except Exception:
                    pass

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
        """Main station loop; reconnect automatically after temporary API/network errors."""
        self.logger.info("Starting PrintF Agent...")
        self.running = True
        retry_delay = 5
        authenticated = False
        try:
            while self.running:
                if not authenticated:
                    authenticated = self.authenticate()
                    if not authenticated:
                        time.sleep(min(30, retry_delay))
                        retry_delay = min(30, retry_delay * 2)
                        continue
                    retry_delay = 5
                    self.update_status("online")
                    printers = self.list_printers()
                    self.logger.info("Available printers: %s", printers)
                    self.logger.info("Default printer: %s", self.get_default_printer())
                    self.log_event("PrintF Agent started/reconnected", "info")

                try:
                    self.update_status("online")
                    jobs = self.poll_jobs()
                    for job in jobs:
                        if not self.running:
                            break
                        try:
                            self.process_job(job)
                        except Exception as exc:
                            self.logger.exception("Unhandled error processing job %s: %s", job.get("id"), exc)
                            if job.get("id"):
                                self.update_job_status(job["id"], "failed")
                                self.log_event("Unhandled print-job processing error", "error", job["id"])
                    time.sleep(max(2, min(60, int(self.poll_interval))))
                except Exception as exc:
                    self.logger.exception("Temporary agent loop error: %s", exc)
                    authenticated = False
                    time.sleep(retry_delay)
                    retry_delay = min(30, retry_delay * 2)
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
