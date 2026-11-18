@echo off
title WhatsApp Ticketing System - Launcher
echo ===================================================
echo   Starting WhatsApp Ticketing System Demo
echo ===================================================
echo.

cd /d "%~dp0"

echo 1. Starting Backend & WhatsApp Bot on port 5050...
start "WhatsApp Bot & Backend" cmd /k "set PORT=5050 && node server.js & node scripts/chatbot.js"

timeout /t 3 /nobreak > nul

echo 2. Starting Cloudflare Public Tunnel (IPv4 + HTTP/2)...
start "Cloudflare Tunnel" cmd /k "cloudflared.exe tunnel --edge-ip-version 4 --protocol http2 --url http://localhost:5050"

echo.
echo ===================================================
echo [!] Two windows have opened:
echo     1. "WhatsApp Bot & Backend":
echo        - Connects to MongoDB
echo        - Generates the WhatsApp QR code
echo        - You can also view the QR code in your browser:
echo          http://localhost:5050/qr
echo.
echo     2. "Cloudflare Tunnel":
echo        - Look for the line:
echo          https://xxxx.trycloudflare.com
echo        - Copy that HTTPS URL!
echo        - Go to Vercel -> Settings -> Environment Variables
echo        - Set REACT_APP_BACKEND_URL to that URL
echo        - Redeploy on Vercel
echo ===================================================
pause
