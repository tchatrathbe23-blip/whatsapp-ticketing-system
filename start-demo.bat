@echo off
title WhatsApp Ticketing System - Launcher
echo ===================================================
echo   WhatsApp Ticketing System - Permanent Setup
echo   URL: https://boxcar-sanctity-research.ngrok-free.dev
echo ===================================================
echo.

cd /d "%~dp0"

echo 1. Starting Backend API Server (Port 5050)...
start "1. Backend Server" cmd /k "set PORT=5050 && node server.js"

timeout /t 2 /nobreak > nul

echo 2. Starting WhatsApp Bot (WPPConnect)...
start "2. WhatsApp Bot" cmd /k "set PORT=5050 && node scripts/chatbot.js"

timeout /t 2 /nobreak > nul

echo 3. Starting Permanent Tunnel (ngrok)...
start "3. Permanent Public Tunnel" cmd /k "ngrok.exe http 5050 --url=boxcar-sanctity-research.ngrok-free.dev --authtoken=3MHDXgQ0rd8LbWiMSP3Wyz5LpgL_68n7fzqm2iwaYx2cj6h7w"

echo.
echo ===================================================
echo [!] ALL 3 SERVICES STARTED!
echo.
echo     Your Permanent Backend URL is:
echo     👉 https://boxcar-sanctity-research.ngrok-free.dev
echo.
echo     Set this ONCE in Vercel:
echo     REACT_APP_BACKEND_URL = https://boxcar-sanctity-research.ngrok-free.dev
echo.
echo     Scan the QR code in the Chrome window or at:
echo     http://localhost:5050/qr
echo ===================================================
pause
