@echo off
setlocal
set "ROOT=%~dp0.."
cd /d "%ROOT%"

if not exist ".venv\Scripts\python.exe" (
  echo Python environment is missing. Running setup first...
  call "%ROOT%\setup.bat"
  if not exist ".venv\Scripts\python.exe" exit /b 1
)

set "STI_LOCATOR_ENV=local"
echo Starting desktop admin [LOCAL]...
echo Local Firebase must be running: .\run.bat local-db
call ".venv\Scripts\python.exe" desktop_app\admin.py
