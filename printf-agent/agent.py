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
import shutil
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
                return self._print_pdf(file_path, printer_name, copies, color, duplex, settings)
            elif file_extension in [".jpg", ".jpeg", ".png", ".bmp", ".gif"]:
                return self._print_image(file_path, printer_name, copies, color, duplex, settings)
            elif file_extension in [".doc", ".docx"]:
                return self._print_office_doc(file_path, printer_name, copies, color, duplex, settings)
            else:
                # Try to print as raw text
                return self._print_raw(file_path, printer_name, copies)
                
        except Exception as e:
            self.logger.error(f"Print failed: {e}")
            return False
    
    def _prepare_pdf_for_print(self, file_path: Path, settings: Dict[str, Any]) -> Path:
        """Apply selected pages and N-up layout to a temporary PDF before printing."""
        import fitz

        source = fitz.open(str(file_path))
        if source.page_count < 1:
            source.close()
            raise ValueError("PDF contains no pages")

        total_pages = source.page_count
        page_range = str(settings.get("page_range") or "").strip()
        selected_indices: List[int] = []
        if not page_range:
            selected_indices = list(range(total_pages))
        else:
            for part in page_range.split(","):
                token = part.strip()
                if not token:
                    continue
                match = __import__("re").fullmatch(r"(\d+)(?:\s*-\s*(\d+))?", token)
                if not match:
                    source.close()
                    raise ValueError("Invalid page range: " + token)
                first = int(match.group(1))
                last = int(match.group(2) or first)
                if first < 1 or first > total_pages or last < 1 or last > total_pages:
                    source.close()
                    raise ValueError("Page range is outside the document")
                step = 1 if last >= first else -1
                for page_number in range(first, last + step, step):
                    index = page_number - 1
                    if index not in selected_indices:
                        selected_indices.append(index)

        if not selected_indices:
            source.close()
            raise ValueError("The selected page range contains no pages")

        layout = int(settings.get("layout", 1) or 1)
        if layout not in (1, 2, 4):
            layout = 1

        fd, temporary_name = tempfile.mkstemp(prefix="printf-prepared-", suffix=".pdf", dir=str(self.download_path))
        os.close(fd)
        prepared_path = Path(temporary_name)
        try:
            output = fitz.open()
            if layout == 1:
                for page_index in selected_indices:
                    output.insert_pdf(source, from_page=page_index, to_page=page_index)
            else:
                # A4 dimensions in PDF points. Two-up uses landscape A4; four-up uses portrait A4.
                if layout == 2:
                    page_width, page_height, columns, rows = 841.89, 595.28, 2, 1
                else:
                    page_width, page_height, columns, rows = 595.28, 841.89, 2, 2
                cell_width = page_width / columns
                cell_height = page_height / rows
                output_page = None
                for position, source_index in enumerate(selected_indices):
                    slot = position % layout
                    if slot == 0:
                        output_page = output.new_page(width=page_width, height=page_height)
                    row = slot // columns
                    column = slot % columns
                    target = fitz.Rect(
                        column * cell_width,
                        row * cell_height,
                        (column + 1) * cell_width,
                        (row + 1) * cell_height,
                    )
                    output_page.show_pdf_page(target, source, source_index, keep_proportion=True)
            output.save(str(prepared_path), garbage=4, deflate=True)
            output.close()
            return prepared_path
        except Exception:
            try:
                prepared_path.unlink(missing_ok=True)
            except Exception:
                pass
            raise
        finally:
            source.close()

    def _print_pdf(self, file_path: Path, printer_name: str, copies: int, color: bool, duplex: bool,
                   settings: Dict[str, Any]) -> bool:
        """Print a PDF with requested page range, layout, colour, copies and duplex options."""
        prepared_path: Optional[Path] = None
        actual_file = file_path
        try:
            layout = int(settings.get("layout", 1) or 1)
            if str(settings.get("page_range") or "").strip() or layout in (2, 4):
                prepared_path = self._prepare_pdf_for_print(file_path, settings)
                actual_file = prepared_path

            sumatra_paths = [
                r"C:\Program Files\SumatraPDF\SumatraPDF.exe",
                r"C:\Program Files (x86)\SumatraPDF\SumatraPDF.exe",
                os.path.expanduser(r"~\AppData\Local\SumatraPDF\SumatraPDF.exe"),
            ]
            sumatra_exe = next((path for path in sumatra_paths if os.path.exists(path)), None)
            if sumatra_exe:
                print_settings = [
                    f"{max(1, min(100, int(copies)))}x",
                    "paper=A4",
                    "fit",
                    "color" if color else "monochrome",
                    "duplexlong" if duplex else "simplex",
                ]
                if settings.get("borderless"):
                    self.logger.info("Borderless was requested; the printer driver must support borderless A4.")
                command = [
                    sumatra_exe,
                    "-print-to", printer_name,
                    "-print-settings", ",".join(print_settings),
                    "-silent",
                    str(actual_file),
                ]
                self.logger.info("Printing PDF with SumatraPDF and requested settings")
                result = subprocess.run(command, capture_output=True, text=True, timeout=180, check=False)
                if result.returncode == 0:
                    self.logger.info("PDF printed successfully via SumatraPDF")
                    return True
                self.logger.error("SumatraPDF returned %s: %s", result.returncode, (result.stderr or result.stdout or "")[:500])
                return False

            # Fallback for stations without SumatraPDF. The preprocessed PDF still
            # honors selected pages and N-up layout; colour and duplex use driver defaults.
            self.logger.warning("SumatraPDF not found; using Windows shell printing and printer-driver defaults for colour/duplex.")
            for _ in range(max(1, min(100, int(copies)))):
                operation = win32api.ShellExecute(
                    0, "print", str(actual_file), f'/d:"{printer_name}"', ".", 0
                )
                if int(operation) <= 32:
                    self.logger.error("Windows shell print failed with code %s", operation)
                    return False
                time.sleep(2)
            return True
        except (subprocess.TimeoutExpired, OSError, ValueError, RuntimeError) as exc:
            self.logger.error("PDF print failed: %s", exc)
            return False
        except Exception as exc:
            self.logger.exception("PDF print failed: %s", exc)
            return False
        finally:
            if prepared_path:
                try:
                    prepared_path.unlink(missing_ok=True)
                except Exception as exc:
                    self.logger.warning("Could not remove prepared PDF %s: %s", prepared_path, exc)

    def _print_image(self, file_path: Path, printer_name: str, copies: int, color: bool, duplex: bool,
                     settings: Dict[str, Any]) -> bool:
        """Convert a photo to PDF so the same A4/copies/colour/duplex options can be applied."""
        temporary_pdf: Optional[Path] = None
        try:
            from PIL import Image

            fd, temporary_name = tempfile.mkstemp(prefix="printf-image-", suffix=".pdf", dir=str(self.download_path))
            os.close(fd)
            temporary_pdf = Path(temporary_name)
            with Image.open(file_path) as source_image:
                # PDF embedding is more reliable than the legacy GDI code that created a
                # bitmap but never drew it into the printer device context.
                printable = source_image.convert("RGB")
                printable.save(str(temporary_pdf), "PDF", resolution=150.0)
                printable.close()
            return self._print_pdf(temporary_pdf, printer_name, copies, color, duplex, settings)
        except Exception as exc:
            self.logger.exception("Image print failed: %s", exc)
            return False
        finally:
            if temporary_pdf:
                try:
                    temporary_pdf.unlink(missing_ok=True)
                except Exception as exc:
                    self.logger.warning("Could not remove temporary image PDF %s: %s", temporary_pdf, exc)

    def _print_office_doc(self, file_path: Path, printer_name: str, copies: int, color: bool,
                          duplex: bool, settings: Dict[str, Any]) -> bool:
        """Convert Word files with LibreOffice when installed, then apply PDF print settings."""
        candidates = [
            shutil.which("soffice"),
            str(Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "LibreOffice" / "program" / "soffice.exe"),
            str(Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")) / "LibreOffice" / "program" / "soffice.exe"),
        ]
        soffice = next((candidate for candidate in candidates if candidate and os.path.exists(candidate)), None)

        if soffice:
            try:
                with tempfile.TemporaryDirectory(prefix="printf-office-", dir=str(self.download_path)) as temp_dir:
                    output_dir = Path(temp_dir)
                    profile_dir = output_dir / "lo-profile"
                    converted_pdf = output_dir / (file_path.stem + ".pdf")
                    command = [
                        soffice,
                        f"-env:UserInstallation={profile_dir.as_uri()}",
                        "--headless",
                        "--convert-to", "pdf",
                        "--outdir", str(output_dir),
                        str(file_path.resolve()),
                    ]
                    self.logger.info("Converting Office document to PDF for controlled print settings")
                    result = subprocess.run(
                        command, capture_output=True, text=True, timeout=180, check=False
                    )
                    if result.returncode == 0 and converted_pdf.exists() and converted_pdf.stat().st_size > 0:
                        return self._print_pdf(
                            converted_pdf, printer_name, copies, color, duplex, settings
                        )
                    self.logger.warning(
                        "LibreOffice PDF conversion failed (%s): %s",
                        result.returncode, (result.stderr or result.stdout or "")[:500]
                    )
            except (subprocess.TimeoutExpired, OSError, RuntimeError) as exc:
                self.logger.warning("LibreOffice conversion unavailable for %s: %s", file_path.name, exc)

        # Fallback to the Windows registered handler if LibreOffice isn't installed.
        # This fallback can honour copies via the print handler, but page range/layout,
        # colour and duplex depend on the installed application and printer driver.
        self.logger.warning(
            "LibreOffice is unavailable; Office print settings beyond copies depend on the Windows print handler/driver."
        )
        try:
            for _ in range(max(1, min(100, int(copies)))):
                operation = win32api.ShellExecute(
                    0,
                    "print",
                    str(file_path),
                    f'/d:"{printer_name}"',
                    ".",
                    0
                )
                if int(operation) <= 32:
                    self.logger.error("Windows Office print handler failed with code %s", operation)
                    return False
                time.sleep(3)
            self.logger.info("Office document sent to printer")
            return True
        except Exception as exc:
            self.logger.error("Office document print failed: %s", exc)
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
    """Start the station loop or run a one-shot --test authentication check."""
    print("=" * 50)
    print("  PrintF Agent for Windows")
    print("=" * 50)
    print()

    try:
        agent = PrintFAgent()
        if "--test" in sys.argv:
            if agent.authenticate():
                agent.update_status("online")
                print("Authentication: SUCCESS")
                print("Station ID:", agent.printf_id)
                print("Station name is visible in the successful Supabase response.")
                sys.exit(0)
            print("Authentication: FAILED. Check printf_id, station api_key, project URL and deployed function.")
            sys.exit(1)
        agent.run()
    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
