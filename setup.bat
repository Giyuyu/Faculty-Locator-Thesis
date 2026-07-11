@echo off
setlocal
cd /d "%~dp0"

echo.
echo ========================================
echo  STI Locator - First Time Setup
echo ========================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js/npm is not installed.
  echo Install Node.js LTS, then run setup.bat again.
  echo https://nodejs.org/
  pause
  exit /b 1
)

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python is not installed or not in PATH.
  echo Install Python 3.11 or newer, then run setup.bat again.
  echo https://www.python.org/downloads/
  pause
  exit /b 1
)

echo [1/3] Installing web app dependencies...
call npm install
if errorlevel 1 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

echo.
echo [2/3] Setting up Python desktop environment...
if not exist ".venv\Scripts\python.exe" (
  python -m venv .venv
  if errorlevel 1 (
    echo [ERROR] Failed to create Python virtual environment.
    pause
    exit /b 1
  )
)
call ".venv\Scripts\python.exe" -m pip install --upgrade pip
call ".venv\Scripts\python.exe" -m pip install -r desktop_app\requirements.txt
if errorlevel 1 (
  echo [ERROR] Python dependency install failed.
  pause
  exit /b 1
)

echo.
echo [3/3] Installing Flutter mobile dependencies...
where flutter >nul 2>nul
if errorlevel 1 (
  echo [WARN] Flutter was not found. Skipping mobile setup.
  echo Install Flutter later if you need the mobile app:
  echo https://docs.flutter.dev/get-started/install
) else (
  pushd "Mobile App"
  call flutter pub get
  if errorlevel 1 (
    popd
    echo [ERROR] Flutter dependency install failed.
    pause
    exit /b 1
  )
  popd
)

echo.
echo Setup complete.
echo.
echo Run web app:          run-web.bat
echo Run mobile web app:   run-mobile-web.bat
echo Run faculty login:    run-desktop-login.bat
echo Run admin desktop:    run-desktop-admin.bat
echo.
pause
