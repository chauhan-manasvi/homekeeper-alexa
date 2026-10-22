# One-step setup and start for HomeKeeper on Windows.
# Installs Node.js if it is missing, installs packages, creates .env, asks for a free Groq key,
# then starts HomeKeeper and opens it in the browser.
# Double-click setup.bat to run it (setup.bat calls this script).

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  [!]  $msg" -ForegroundColor Yellow }
function Fail($msg) {
  Write-Host "  [X]  $msg" -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit 1
}

function Get-NodeMajor {
  try { [int](& node -p "process.versions.node.split('.')[0]" 2>$null) } catch { 0 }
}

# A fresh Node.js install isn't on this window's PATH yet, so add the usual install folders.
function Add-NodeToPath {
  foreach ($dir in @("$env:ProgramFiles\nodejs", "${env:ProgramFiles(x86)}\nodejs", "$env:LOCALAPPDATA\Programs\nodejs")) {
    if ((Test-Path "$dir\node.exe") -and ($env:Path -notlike "*$dir*")) { $env:Path = "$dir;$env:Path" }
  }
}

function Open-Browser($url) {
  try { Start-Process chrome $url }
  catch {
    try { Start-Process msedge $url } catch { Start-Process $url }
  }
}

Write-Host ""
Write-Host "HomeKeeper setup" -ForegroundColor Cyan
Write-Host ""

# 1. Node.js 20 or newer, installed automatically when missing
Add-NodeToPath
if ((Get-NodeMajor) -lt 20) {
  Write-Host "  Node.js 20 or newer is needed. Installing Node.js LTS now."
  Write-Host "  Windows may ask for permission. Please click Yes."
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    & winget install -e --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
    Add-NodeToPath
  }
  if ((Get-NodeMajor) -lt 20) {
    # No winget, or it failed: download the official installer from nodejs.org.
    try {
      # Parentheses make PowerShell pass the releases one by one instead of as a single array.
      $release = (Invoke-RestMethod 'https://nodejs.org/dist/index.json') |
        Where-Object { $_.lts -and ($_.files -contains 'win-x64-msi') } | Select-Object -First 1
      $version = $release.version
      $msi = Join-Path $env:TEMP "node-$version-x64.msi"
      Write-Host "  Downloading Node.js $version..."
      Invoke-WebRequest "https://nodejs.org/dist/$version/node-$version-x64.msi" -OutFile $msi -UseBasicParsing
      Write-Host "  Installing Node.js $version..."
      Start-Process msiexec.exe -ArgumentList '/i', "`"$msi`"", '/passive', '/norestart' -Wait
      Add-NodeToPath
    } catch {
      Warn "Download failed: $($_.Exception.Message)"
    }
  }
  if ((Get-NodeMajor) -lt 20) {
    Fail "Couldn't install Node.js automatically. Install it from https://nodejs.org, then double-click setup.bat again."
  }
}
Ok "Node.js $(& node -v)"

# 2. Packages (from package.json / package-lock.json)
if ((Test-Path 'node_modules\@modelcontextprotocol\sdk') -and (Test-Path 'node_modules\express')) {
  Ok "Packages already installed"
} else {
  Write-Host "  Installing packages..."
  & npm.cmd install --no-fund --no-audit
  if ($LASTEXITCODE -ne 0) { Fail "Installing packages failed. Check your internet connection and run setup.bat again." }
  Ok "Packages installed"
}

# 3. .env file
$envPath = Join-Path $PSScriptRoot '.env'
if (Test-Path $envPath) {
  Ok ".env already exists"
} else {
  Copy-Item (Join-Path $PSScriptRoot '.env.example') $envPath
  Ok "Created .env from .env.example"
}

# 4. Model key: the simulator's agent needs one provider
$envText = [IO.File]::ReadAllText($envPath)
if ($envText -match '(?m)^(GROQ_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY|LLM_PROVIDER)=\S') {
  Ok "Model provider is set in .env"
} else {
  Write-Host ""
  Write-Host "  The voice assistant needs a free Groq API key (no credit card)."
  Write-Host "  Get one at https://console.groq.com/keys, then paste it below."
  $key = (Read-Host "  Groq API key (press Enter to skip)").Trim()
  if ($key) {
    $line = "GROQ_API_KEY=$key"
    if ($envText -match '(?m)^#?\s*GROQ_API_KEY=.*$') {
      $envText = [regex]::Replace($envText, '(?m)^#?\s*GROQ_API_KEY=.*$', $line.Replace('$', '$$'))
    } else {
      $envText += "`r`n$line`r`n"
    }
    [IO.File]::WriteAllText($envPath, $envText, (New-Object Text.UTF8Encoding $false))
    Ok "Saved the Groq key in .env"
  } else {
    Warn "Skipped. Alexa can't answer until you add GROQ_API_KEY to .env and run setup.bat again."
  }
}

# 5. Start HomeKeeper and open it in the browser
$port = 8787
if ($envText -match '(?m)^PORT=(\d+)') { $port = [int]$Matches[1] }
$url = "http://localhost:$port"

$running = $null
try { $running = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue } catch { }
if ($running) {
  Warn "HomeKeeper (or another app) is already running on port $port. Opening it in the browser."
  Open-Browser $url
  exit 0
}

# Open the browser in the background as soon as the server answers.
$opener = @"
for (`$i = 0; `$i -lt 90; `$i++) {
  try { Invoke-WebRequest '$url/api/info' -UseBasicParsing -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep -Seconds 1 }
}
try { Start-Process chrome '$url' } catch { try { Start-Process msedge '$url' } catch { Start-Process '$url' } }
"@
Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile', '-Command', $opener

Write-Host ""
Write-Host "Starting HomeKeeper at $url" -ForegroundColor Cyan
Write-Host "The browser will open by itself. Keep this window open while you use HomeKeeper."
Write-Host "To stop HomeKeeper, close this window or press Ctrl+C."
Write-Host ""
& npm.cmd start
