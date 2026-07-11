@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules" (
  echo Web dependencies are missing. Running npm install first...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

echo Starting STI Locator web app...
call npm run dev
