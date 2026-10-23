# PrintF Agent for Windows

A Python-based print agent that runs on Windows machines to poll for print jobs and execute silent printing.

## Requirements

- Python 3.9+
- Windows 10/11
- A printer installed and available to the Windows account running the agent
- SumatraPDF installed for silent PDF printing with page ranges, N-up layouts, A4 fitting, colour/monochrome, and duplex settings
- Microsoft Word or a registered Windows print handler for DOC/DOCX files

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Copy `config.example.json` to `config.json` and update with your PrintF credentials:
```bash
copy config.example.json config.json
```

3. Edit `config.json` with your PrintF ID and API key from the admin dashboard.

## Configuration

Edit `config.json`:
```json
{
  "printf_id": "your-printf-uuid",
  "api_key": "your-printf-api-key",
  "supabase_url": "https://unqongjwukgjbasvpyup.supabase.co",
  "supabase_anon_key": "YOUR_SUPABASE_PUBLISHABLE_KEY",
  "printer_name": "",
  "poll_interval": 5,
  "download_path": "./downloads",
  "log_level": "INFO"
}
```

- `printf_id`: UUID of this PrintF machine from the database
- `api_key`: API key for authentication (from printfs table)
- `printer_name`: Leave empty to use default printer, or specify a printer name
- `poll_interval`: Seconds between job polls (default: 5)
- `download_path`: Where to temporarily store downloaded files
- `log_level`: DEBUG, INFO, WARNING, ERROR

## Running the Agent

```bash
python agent.py
```

Or run as a Windows service (see below).

## Running as Windows Service

1. Install pywin32:
```bash
pip install pywin32
```

2. Install the service:
```bash
python service.py install
```

3. Start the service:
```bash
python service.py start
```

## How It Works

1. Agent authenticates with Supabase using the PrintF's API key
2. Polls for jobs with status `ready` assigned to this PrintF
3. Downloads the file from Supabase Storage
4. Prints using Windows printing subsystem
5. Updates job status to `completed` or `failed`
6. Cleans up temporary files

## Troubleshooting

- Check `printf_agent.log` for detailed logs
- Ensure printer is online and set as default
- Verify API key matches the one in the database
- Check network connectivity to Supabase

## License

MIT
