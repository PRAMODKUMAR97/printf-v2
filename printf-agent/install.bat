@echo off
echo ========================================
echo   PrintF Agent Installer for Windows
echo ========================================
echo.

REM Check for Python
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.9+ from https://python.org
    pause
    exit /b 1
)

echo Installing Python dependencies...
pip install -r requirements.txt

if errorlevel 1 (
    echo Error: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Dependencies installed successfully!
echo.

REM Check for config file
if not exist config.json (
    echo Creating config.json from template...
    copy config.example.json config.json
    echo.
    echo IMPORTANT: Please edit config.json with your PrintF credentials!
    echo You can find your PrintF ID and API key in the admin dashboard.
    echo.
    notepad config.json
)

echo.
echo Installation complete!
echo.
echo To run the agent manually:
echo   python agent.py
echo.
echo To install as a Windows service:
echo   python service.py install
echo   python service.py start
echo.
pause
