@echo off
setlocal
set "ROOT=%~dp0.."
cd /d "%ROOT%"

where java >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Java 21 or newer is required by the Firebase Database Emulator.
  echo Install Java, restart PowerShell, and run this command again.
  exit /b 1
)

if not exist "node_modules\firebase-tools" (
  echo Firebase Emulator dependencies are missing. Running npm install first...
  call npm install
  if errorlevel 1 exit /b 1
)

if not exist "data\local-firebase" mkdir "data\local-firebase"
if not exist "logs" mkdir "logs"

echo Starting shared STI Locator local Firebase...
echo Emulator UI: http://127.0.0.1:4000
echo Keep this window open while using a local client.
echo.

start "" /b cmd /d /c "node scripts\seed-local-firebase.js > logs\local-firebase-seed.log 2>&1"

if exist "data\local-firebase\firebase-export-metadata.json" (
  call npx firebase emulators:start --project sti-locator-local --only auth,database --import "data\local-firebase" --export-on-exit "data\local-firebase"
) else (
  call npx firebase emulators:start --project sti-locator-local --only auth,database --export-on-exit "data\local-firebase"
)
