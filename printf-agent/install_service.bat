@echo off
setlocal
cd /d "%~dp0"

REM Prepare local configuration before the Windows service starts.
if not exist config.json (
  if not exist config.example.json (
    echo ERROR: config.example.json was not found.
    pause
    exit /b 1
  )
  copy config.example.json config.json >nul
  echo Created config.json from the non-secret template.
  echo Fill printf_id and api_key with the values for the SAME PrintF v2 station.
  notepad config.json
  echo Save config.json and close Notepad before continuing.
  pause
)

echo Installing PrintF Agent dependencies...
py -m pip install --upgrade pip
if errorlevel 1 goto error
py -m pip install -r requirements.txt
if errorlevel 1 goto error

echo Installing PrintF Agent as an automatic Windows service...
py service.py --startup auto install
if errorlevel 1 goto error

REM Configure automatic startup and recovery when Windows reports a service failure.
sc.exe config PrintFAgent start= auto
sc.exe failure PrintFAgent reset= 86400 actions= restart/5000/restart/10000/restart/30000
sc.exe failureflag PrintFAgent 1

echo Starting PrintF Agent service...
py service.py start
if errorlevel 1 goto error

echo.
echo PrintF Agent service installed and started.
echo Keep the printer, computer and network connected; disable Windows sleep for 24x7 operation.
echo Test authentication later with: py agent.py --test
pause
exit /b 0

:error
echo Installation failed. Check Python, credentials, and run this script as Administrator.
pause
exit /b 1
