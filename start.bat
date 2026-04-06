@echo off
REM Photo Map - Full Stack Startup Script (Windows)
REM Starts both Angular frontend and Statamic backend

echo.
echo ========================================
echo Photo Map - Starting Full Stack
echo ========================================
echo.

REM Check if we're in the right directory
if not exist backend (
    echo Error: backend folder not found
    echo Please run this script from the project root
    pause
    exit /b 1
)

if not exist src (
    echo Error: src folder not found
    echo Please run this script from the project root
    pause
    exit /b 1
)

echo 1. Starting Statamic Backend on port 8000...
cd backend
start "Photo Map Backend" php artisan serve --host=localhost --port=8000
cd ..

echo 2. Waiting for backend to initialize...
timeout /t 3

echo 3. Starting Angular Frontend on port 4200...
start "Photo Map Frontend" ng serve

echo.
echo ========================================
echo Full Stack Started!
echo ========================================
echo.
echo URLs:
echo   Frontend:  http://localhost:4200
echo   Backend:   http://localhost:8000
echo   Admin:     http://localhost:8000/cp
echo.
echo Close both windows to shutdown services
echo.
pause
