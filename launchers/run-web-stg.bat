@echo off
setlocal
set "ROOT=%~dp0.."
cd /d "%ROOT%"

if not exist "node_modules" (
  echo Web dependencies are missing. Running npm install first...
  call npm install
  if errorlevel 1 exit /b 1
)

echo Starting STI Locator web app [STAGING]...
call npm run dev:stg
