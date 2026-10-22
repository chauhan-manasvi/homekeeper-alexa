@echo off
rem One-step setup for HomeKeeper on Windows.
rem Checks Node.js, installs packages if needed, creates .env and asks for a free Groq key.
rem Usage: double-click setup.bat, or run it from Command Prompt.

setlocal
cd /d "%~dp0"
echo HomeKeeper setup
echo.

rem 1. Node.js 20 or newer
where node >nul 2>nul
if errorlevel 1 (
  echo   X Node.js is not installed. Install Node.js 20 or newer from https://nodejs.org and run this again.
  goto :end
)
for /f %%v in ('node -p "process.versions.node.split('.')[0]"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 20 (
  echo   X Your Node.js is too old. Install Node.js 20 or newer from https://nodejs.org and run this again.
  goto :end
)
for /f %%v in ('node -v') do echo   OK Node.js %%v

rem 2. Packages (from package.json / package-lock.json)
if exist "node_modules\@modelcontextprotocol\sdk" if exist "node_modules\express" (
  echo   OK Packages already installed
  goto :env
)
echo   Installing packages...
call npm install --no-fund --no-audit
if errorlevel 1 (
  echo   X npm install failed. Check your internet connection and try again.
  goto :end
)
echo   OK Packages installed

:env
rem 3. .env file
if exist ".env" (
  echo   OK .env already exists
) else (
  copy /y ".env.example" ".env" >nul
  echo   OK Created .env from .env.example
)

rem 4. Model key: the simulator's agent needs one provider
findstr /r /b "GROQ_API_KEY=. GEMINI_API_KEY=. ANTHROPIC_API_KEY=. LLM_PROVIDER=." ".env" >nul
if not errorlevel 1 (
  echo   OK Model provider is set in .env
  goto :done
)
echo.
echo   The voice assistant needs a free Groq API key (no credit card).
echo   Get one at https://console.groq.com/keys, then paste it below.
set "GROQ_KEY="
set /p GROQ_KEY="  Groq API key (press Enter to skip): "
if "%GROQ_KEY%"=="" (
  echo   ! Skipped. Add GROQ_API_KEY to .env later, or set LLM_PROVIDER=ollama to use a local model.
  goto :done
)
node -e "const fs=require('fs');let env=fs.readFileSync('.env','utf8');const line='GROQ_API_KEY='+process.env.GROQ_KEY.trim();env=/^#?\s*GROQ_API_KEY=.*$/m.test(env)?env.replace(/^#?\s*GROQ_API_KEY=.*$/m,line):env+'\n'+line+'\n';fs.writeFileSync('.env',env);"
echo   OK Saved the Groq key in .env

:done
echo.
echo All set. Start HomeKeeper with:
echo.
echo   npm start
echo.
echo Then open http://localhost:8787 in Chrome or Edge.

:end
echo.
pause
endlocal
