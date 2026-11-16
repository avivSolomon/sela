@echo off
rem Double-click launcher for Sela Production (no Node.js required)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-sela-prod.ps1" %*
if errorlevel 1 pause
