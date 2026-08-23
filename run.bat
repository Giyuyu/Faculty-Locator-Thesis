@echo off
setlocal

if "%~1"=="" goto menu
goto dispatch

:menu
echo.
echo ========================================
echo  STI Locator Launcher
echo ========================================
echo  1. Web - Staging
echo  2. Web - Production
echo  3. Desktop Login - Staging
echo  4. Desktop Login - Production
echo  5. Desktop Admin - Staging
echo  6. Desktop Admin - Production
echo  7. Mobile Web - Staging
echo  8. Mobile Web - Production
echo  9. Mobile Device - Staging
echo 10. Mobile Device - Production
echo  0. Exit
echo.
set /p "CHOICE=Select an option: "

if "%CHOICE%"=="1" set "COMMAND=web-stg"
if "%CHOICE%"=="2" set "COMMAND=web-prod"
if "%CHOICE%"=="3" set "COMMAND=login-stg"
if "%CHOICE%"=="4" set "COMMAND=login"
if "%CHOICE%"=="5" set "COMMAND=admin-stg"
if "%CHOICE%"=="6" set "COMMAND=admin"
if "%CHOICE%"=="7" set "COMMAND=mobile-web-stg"
if "%CHOICE%"=="8" set "COMMAND=mobile-web"
if "%CHOICE%"=="9" set "COMMAND=mobile-stg"
if "%CHOICE%"=="10" set "COMMAND=mobile-prod"
if "%CHOICE%"=="0" exit /b 0
if not defined COMMAND (
  echo [ERROR] Invalid selection.
  exit /b 1
)
goto execute

:dispatch
set "COMMAND=%~1"

:execute
if /i "%COMMAND%"=="web" set "COMMAND=web-stg"

if /i "%COMMAND%"=="web-stg" goto run_web_stg
if /i "%COMMAND%"=="web-prod" goto run_web_prod
if /i "%COMMAND%"=="login" goto run_login
if /i "%COMMAND%"=="login-stg" goto run_login_stg
if /i "%COMMAND%"=="admin" goto run_admin
if /i "%COMMAND%"=="admin-stg" goto run_admin_stg
if /i "%COMMAND%"=="mobile-web" goto run_mobile_web
if /i "%COMMAND%"=="mobile-web-stg" goto run_mobile_web_stg
if /i "%COMMAND%"=="mobile-prod" goto run_mobile_prod
if /i "%COMMAND%"=="mobile-stg" goto run_mobile_stg

echo [ERROR] Unknown command: %COMMAND%
echo.
echo Available commands:
echo   web-stg, web-prod, login-stg, login, admin-stg,
echo   admin, mobile-web-stg,
echo   mobile-web, mobile-stg, mobile-prod
exit /b 1

:run_web_stg
call "%~dp0launchers\run-web-stg.bat" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%

:run_web_prod
call "%~dp0launchers\run-web-prod.bat" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%

:run_login
call "%~dp0launchers\run-desktop-login.bat" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%

:run_login_stg
call "%~dp0launchers\run-desktop-login-stg.bat" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%

:run_admin
call "%~dp0launchers\run-desktop-admin.bat" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%

:run_admin_stg
call "%~dp0launchers\run-desktop-admin-stg.bat" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%

:run_mobile_web
call "%~dp0launchers\run-mobile-web.bat" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%

:run_mobile_web_stg
call "%~dp0launchers\run-mobile-web-stg.bat" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%

:run_mobile_prod
call "%~dp0launchers\run-mobile-prod.bat" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%

:run_mobile_stg
call "%~dp0launchers\run-mobile-stg.bat" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%
