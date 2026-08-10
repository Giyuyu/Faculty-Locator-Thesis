@echo off
setlocal
set "ROOT=%~dp0.."
cd /d "%ROOT%\Mobile App"

where flutter >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Flutter is not installed or not in PATH.
  exit /b 1
)
if not exist ".dart_tool" call flutter pub get
if errorlevel 1 exit /b 1

echo Starting STI Locator mobile app [LOCAL]...
echo Android Emulator uses 10.0.2.2 automatically.
echo For a physical device, add --dart-define=LOCAL_FIREBASE_HOST=YOUR_PC_LAN_IP.
call flutter run --dart-define=APP_ENV=local %*
