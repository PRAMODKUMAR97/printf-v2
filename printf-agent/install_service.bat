@echo off
setlocal
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
  echo This installer must run as Administrator to register the Windows service.
  echo Right-click install_service.bat and choose "Run as administrator".
  pause
  exit /b 1
)

if not exist config.json (
  copy config.example.json config.json >nul
  echo Created config.json from the safe template.
  echo Enter the station UUID and matching API key from PrintF v2 before continuing.
  start /wait notepad config.json
)

py -c "import json,sys; c=json.load(open('config.json',encoding='utf-8')); sys.exit(0 if all(c.get(k) and not str(c.get(k)).startswith('SET_') for k in ('printf_id','api_key')) else 1)"
if errorlevel 1 goto config_error

echo Installing PrintF Agent dependencies...
py -m pip install --upgrade pip
if errorlevel 1 goto error
py -m pip install -r requirements.txt
if errorlevel 1 goto error

echo Installing PrintF Agent as an automatic Windows service...
py service.py --startup auto install
if errorlevel 1 goto error

echo Configuring automatic service recovery...
sc.exe config PrintFAgent start= auto
if errorlevel 1 goto error
sc.exe failure PrintFAgent reset= 86400 actions= restart/5000/restart/15000/restart/60000
if errorlevel 1 goto error
sc.exe failureflag PrintFAgent 1
if errorlevel 1 goto error

choice /C YN /M "Disable sleep while plugged in for 24x7 printing"
if errorlevel 2 goto skip_sleep
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0

:skip_sleep
py service.py start
if errorlevel 1 goto error

echo.
echo PrintF Agent service installed and started.
echo Keep this PC, the printer, and network available for continuous service.
pause
exit /b 0

:config_error
echo.
echo config.json still contains placeholder credentials or is invalid JSON.
echo Edit printf_id and api_key, save the file, then run this installer again.
pause
exit /b 1

:error
echo.
echo Installation failed. Check Python, printer config, and Windows service permissions.
pause
exit /b 1
