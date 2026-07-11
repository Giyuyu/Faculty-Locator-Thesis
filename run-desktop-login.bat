@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Python environment is missing. Running setup first...
  call setup.bat
  if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Python environment was not created.
    pause
    exit /b 1
  )
)

call ".venv\Scripts\python.exe" desktop_app\login.py
