@echo off
setlocal

if "%~1"=="" goto menu
goto dispatch

:menu
echo.
echo ========================================
echo  STI Locator Launcher
echo ========================================
echo  1. Local Firebase Database
echo  2. Web - Local
echo  3. Desktop Login - Local
echo  4. Desktop Admin - Local
echo  5. Mobile Web - Local
echo  6. Mobile Device - Local
echo  7. Web - Staging
echo  8. Web - Production
echo  9. Desktop Login - Staging
echo 10. Desktop Login - Production
echo 11. Desktop Admin - Staging
echo 12. Desktop Admin - Production
echo 13. Mobile Web - Staging
echo 14. Mobile Web - Production
echo 15. Mobile Device - Staging
echo 16. Mobile Device - Production
echo  0. Exit
echo.
set /p "CHOICE=Select an option: "

if "%CHOICE%"=="1" set "COMMAND=local-db"
if "%CHOICE%"=="2" set "COMMAND=web-local"
if "%CHOICE%"=="3" set "COMMAND=login-local"
if "%CHOICE%"=="4" set "COMMAND=admin-local"
if "%CHOICE%"=="5" set "COMMAND=mobile-web-local"
if "%CHOICE%"=="6" set "COMMAND=mobile-local"
if "%CHOICE%"=="7" set "COMMAND=web-stg"
if "%CHOICE%"=="8" set "COMMAND=web-prod"
if "%CHOICE%"=="9" set "COMMAND=login-stg"
if "%CHOICE%"=="10" set "COMMAND=login"
if "%CHOICE%"=="11" set "COMMAND=admin-stg"
if "%CHOICE%"=="12" set "COMMAND=admin"
if "%CHOICE%"=="13" set "COMMAND=mobile-web-stg"
if "%CHOICE%"=="14" set "COMMAND=mobile-web"
if "%CHOICE%"=="15" set "COMMAND=mobile-stg"
if "%CHOICE%"=="16" set "COMMAND=mobile-prod"
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

if /i "%COMMAND%"=="local-db" goto run_local_db
if /i "%COMMAND%"=="web-local" goto run_web_local
if /i "%COMMAND%"=="login-local" goto run_login_local
if /i "%COMMAND%"=="admin-local" goto run_admin_local
if /i "%COMMAND%"=="mobile-web-local" goto run_mobile_web_local
if /i "%COMMAND%"=="mobile-local" goto run_mobile_local
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
echo   local-db, web-local, login-local, admin-local,
echo   mobile-web-local, mobile-local, web-stg, web-prod,
echo   login-stg, login, admin-stg, admin, mobile-web-stg,
echo   mobile-web, mobile-stg, mobile-prod
exit /b 1

:run_local_db
call "%~dp0launchers\run-local-db.bat" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%

:run_web_local
call "%~dp0launchers\run-web-local.bat" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%

:run_login_local
call "%~dp0launchers\run-desktop-login-local.bat" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%

:run_admin_local
call "%~dp0launchers\run-desktop-admin-local.bat" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%

:run_mobile_web_local
call "%~dp0launchers\run-mobile-web-local.bat" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%

:run_mobile_local
call "%~dp0launchers\run-mobile-local.bat" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%

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
