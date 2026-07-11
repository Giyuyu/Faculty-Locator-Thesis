@echo off
setlocal
cd /d "%~dp0Mobile App"

where flutter >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Flutter is not installed or not in PATH.
  echo Install Flutter, then run this file again.
  pause
  exit /b 1
)

if not exist ".dart_tool" (
  echo Mobile dependencies are missing. Running flutter pub get first...
  call flutter pub get
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

echo Starting STI Locator mobile app on web...
call flutter run -d chrome
