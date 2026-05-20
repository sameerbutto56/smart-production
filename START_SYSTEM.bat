@echo off
echo ========================================================
echo        SMART PRODUCTION FACTORY SYSTEM STARTUP
echo ========================================================
echo.
echo Starting Backend Database Connection...
cd backend
start cmd /k "npm start"
cd ..

echo Starting Factory Network Website...
cd frontend
start cmd /k "npm run dev -- --host 0.0.0.0"
cd ..

echo.
echo ========================================================
echo SUCCESS! 
echo The system is now running.
echo To access the platform on THIS computer or ANY phone 
echo in the factory, type this EXACT link into the browser:
echo.
echo      http://192.168.18.219:5173
echo.
echo Do not close the black terminal windows.
echo ========================================================
pause
