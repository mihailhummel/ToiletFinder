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
netstat -ano | findstr ":3001" >nul 2>&1
if not errorlevel 1 (
    echo Found existing process on port 3001, stopping it...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001"') do (
        if not "%%a"=="0" (
            echo Stopping process PID: %%a
            taskkill /f /pid %%a >nul 2>&1
        )
    )
    echo Waiting for port to be freed...
    timeout /t 3 /nobreak >nul
) else (
    echo Port 3001 is available
)

echo.
echo Starting server...

REM Start the admin manager with better error handling
node AdminManager.js

REM If we get here, the server stopped
echo.
echo ===============================================
echo    Server has stopped
echo ===============================================
echo.

REM Clean up any remaining processes
netstat -ano | findstr ":3001" >nul 2>&1
if not errorlevel 1 (
    echo Cleaning up remaining processes on port 3001...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001"') do (
        if not "%%a"=="0" (
            taskkill /f /pid %%a >nul 2>&1
        )
    )
)

echo Press any key to exit...
pause >nul