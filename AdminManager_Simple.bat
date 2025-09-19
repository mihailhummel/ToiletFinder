@echo off
title Admin Manager - Toilet Finder
color 0A

echo.
echo ===============================================
echo    🚽 TOILET FINDER - ADMIN MANAGER 🚽  
echo ===============================================
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

REM Check if AdminManager.js exists  
if not exist "AdminManager.js" (
    echo ❌ ERROR: AdminManager.js not found
    echo.
    pause
    exit /b 1
)

echo ✅ AdminManager.js found

REM Kill any existing processes on port 3001
echo.
echo Checking for existing processes on port 3001...
netstat -ano | findstr ":3001" >nul 2>&1
if not errorlevel 1 (
    echo Stopping existing processes on port 3001...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001"') do (
        taskkill /f /pid %%a >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
)

echo Port 3001 is now available
echo.
echo 🚀 Starting Admin Manager...
echo.
echo ===============================================
echo    The admin interface will open automatically
echo    in your browser at: http://localhost:3001
echo ===============================================
echo.
echo To stop: Close this window or press Ctrl+C
echo.

REM Start the admin manager - this will block and show output
node AdminManager.js

echo.
echo ===============================================
echo    Admin Manager has stopped
echo ===============================================
pause
