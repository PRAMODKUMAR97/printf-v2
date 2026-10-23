# PrintF Agent — Windows service

## Setup
1. Copy `config.example.json` to `config.json`.
2. Set `printf_id` and the matching station `api_key` from the same row in PrintF v2's `public.printfs` table.
3. Set `printer_name` to the exact queue name displayed in Windows **Settings → Bluetooth & devices → Printers & scanners**. Do not leave the template placeholder.
4. Run `install_service.bat` as Administrator. It installs dependencies, sets the service to automatic startup, configures restart recovery, and starts the agent.
5. Test credentials with `py agent.py --test`. Start/stop the Windows service from Services or with `py service.py stop` / `py service.py start`.

## Supported file handling
- PDF: with SumatraPDF installed, the agent applies the page range, A4 fit, 1-up/2-up/4-up layout, copies, colour/monochrome and duplex print settings.
- PNG/JPEG images: converted to PDF and processed through the same print-settings path.
- DOC/DOCX: if LibreOffice is installed, the agent converts to PDF first so the same settings can be applied. Without LibreOffice it falls back to the registered Windows print handler; page range/layout/colour/duplex may then depend on that app and the printer driver.
- Borderless output can only be achieved when the installed printer driver and selected paper support borderless printing.

Install SumatraPDF on the printer PC if you need reliable unattended PDF settings. Install LibreOffice for DOC/DOCX conversion to the same controlled PDF print path.

## 24/7 availability
Keep the printer, Windows PC, and network powered on. Disable Windows sleep and configure the Windows printer queue so it is available to the service account. Auto-start/recovery improves restart behavior but cannot guarantee printing through power, network, paper, ink or hardware failures.

Do not commit `config.json`, service credentials, or runtime logs. These files are excluded by `.gitignore`.
