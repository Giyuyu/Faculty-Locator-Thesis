@echo off
setlocal
cd /d "%~dp0"

if exist "..\.venv\Scripts\python.exe" (
  "..\.venv\Scripts\python.exe" -m pip install -r requirements.txt
) else if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt
) else (
  python -m pip install -r requirements.txt
)

pause
