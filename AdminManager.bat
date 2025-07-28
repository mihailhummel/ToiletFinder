@echo off
title Admin Manager - Toilet Finder
color 0A

echo.
echo ===============================================
echo    🚽 TOILET FINDER - ADMIN MANAGER 🚽
echo ===============================================
echo.
echo Starting Admin Manager...
echo.

REM Change to the directory where this batch file is located
cd /d "%~dp0"

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: Node.js is not installed or not in PATH
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js detected
echo.

REM Check if AdminManager.js exists
if not exist "AdminManager.js" (
    echo ❌ ERROR: AdminManager.js not found in current directory
    echo.
    echo Make sure this batch file is in the same folder as AdminManager.js
    echo.
    pause
    exit /b 1
)

echo ✅ AdminManager.js found
echo.

REM Check if Firebase service account key exists
if not exist "firebase-service-account-key.json" (
    echo ⚠️  WARNING: firebase-service-account-key.json not found
    echo           Admin Manager will use mock data for testing
    echo.
)

echo 🚀 Starting Admin Manager...
echo.

REM Kill any existing processes on port 3001 first
echo Checking for existing processes on port 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001"') do (
    if not "%%a"=="0" (
        echo Stopping existing process on port 3001 (PID: %%a)
        taskkill /f /pid %%a >nul 2>&1
    )
)

REM Start the Admin Manager in the background
echo Starting server in background...
start /B node AdminManager.js

REM Store a flag that we started the server
set ADMIN_MANAGER_STARTED=1

REM Wait a moment for the server to start
echo Waiting for server to initialize...
timeout /t 4 /nobreak >nul

REM Check if the server is running
echo Checking server status...
powershell -Command "try { Invoke-WebRequest -Uri http://localhost:3001 -UseBasicParsing -TimeoutSec 10 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo ❌ Server failed to start properly
    echo    Make sure port 3001 is available
    echo.
    if defined NODE_PID taskkill /f /pid %NODE_PID% >nul 2>&1
    pause
    exit /b 1
)

echo ✅ Server is running!
echo.
echo ===============================================
echo    🌐 Opening Admin Dashboard in browser...
echo    👉 http://localhost:3001
echo ===============================================
echo.
echo ⚠️  CONTROLS:
echo    • Close this window to stop the server
echo    • Press Ctrl+C to stop manually
echo    • Browser will open automatically
echo.

REM Open browser
start http://localhost:3001

echo 🔍 Server is running... Close this window to stop.
echo.
echo ===============================================
echo    ADMIN MANAGER IS ACTIVE
echo ===============================================
echo.
echo 📊 Dashboard: http://localhost:3001
echo 🔧 Server PID: %NODE_PID%
echo 📝 Logs visible in real-time above
echo.
echo Press Ctrl+C or close this window to stop
echo ===============================================

REM Keep the window open and monitor
:KEEP_ALIVE
timeout /t 5 /nobreak >nul
REM Check if our Node process is still running
tasklist /fi "pid eq %NODE_PID%" 2>nul | find "%NODE_PID%" >nul
if errorlevel 1 (
    echo.
    echo ⚠️  Server process ended unexpectedly
    goto CLEANUP
)
goto KEEP_ALIVE

:CLEANUP
echo.
echo ===============================================
echo    🛑 Stopping Admin Manager...
echo ===============================================

REM Clean up: Kill our specific Node.js process
if defined NODE_PID (
    echo Stopping server process %NODE_PID%...
    taskkill /f /pid %NODE_PID% >nul 2>&1
)

REM Clean up temp file
if exist %TEMP_PID_FILE% del %TEMP_PID_FILE% >nul 2>&1

echo ✅ Admin Manager stopped
echo.
echo Thanks for using the Admin Manager! 🚽
echo.
pause 