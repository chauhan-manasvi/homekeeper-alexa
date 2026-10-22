@echo off
rem Double-click to set up and start HomeKeeper on Windows.
rem It installs Node.js if needed, installs packages, asks for a free Groq key,
rem then starts HomeKeeper and opens it in the browser. The steps are in setup.ps1.

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
if errorlevel 1 pause
