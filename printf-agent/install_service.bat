@echo off
setlocal
cd /d "%~dp0"
echo Installing PrintF Agent dependencies...
py -m pip install --upgrade pip
if errorlevel 1 goto error
py -m pip install -r requirements.txt
if errorlevel 1 goto error
echo Installing PrintF Agent as an automatic Windows service...
py service.py --startup auto install
if errorlevel 1 goto error
echo Configuring Windows service recovery...
sc failure PrintFAgent reset= 86400 actions= restart/5000/restart/15000/restart/60000
if errorlevel 1 goto error
sc failureflag PrintFAgent 1
if errorlevel 1 goto error
py service.py start
if errorlevel 1 goto error
echo.
echo PrintF Agent service installed and started.
echo Keep the printer, computer, and network available; disable Windows sleep for 24x7 operation.
pause
exit /b 0
:error
echo Installation failed. Check Python and run this script as Administrator.
pause
exit /b 1
