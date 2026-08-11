@echo off
setlocal
set "ROOT=%~dp0.."
cd /d "%ROOT%"

if not exist ".venv\Scripts\python.exe" (
  echo Python environment is missing. Running setup first...
  call "%ROOT%\setup.bat"
  if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Python environment was not created.
    exit /b 1
  )
)

set "STI_LOCATOR_ENV=production"
set "STI_LOCATOR_DESKTOP_CLIENT=admin"
call ".venv\Scripts\python.exe" desktop_app\admin.py
