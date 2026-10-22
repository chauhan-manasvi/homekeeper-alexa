#!/usr/bin/env bash
# One-step setup and start for HomeKeeper on Linux and macOS.
# Checks Node.js (installs it with Homebrew on macOS), installs packages, creates .env,
# asks for a free Groq key, then starts HomeKeeper and opens it in the browser.
# Usage: ./setup.sh   (or: bash setup.sh). Add --no-start to only set up.

set -e
cd "$(dirname "$0")"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; exit 1; }

echo "HomeKeeper setup"
echo

# 1. Node.js 20 or newer
node_major() { command -v node >/dev/null 2>&1 && node -p 'process.versions.node.split(".")[0]' || echo 0; }
if [ "$(node_major)" -lt 20 ] && [ "$(uname)" = "Darwin" ] && command -v brew >/dev/null 2>&1; then
  echo "  Installing Node.js with Homebrew…"
  brew install node
fi
if [ "$(node_major)" -lt 20 ]; then
  fail "Node.js 20 or newer is needed. Install it from https://nodejs.org (or your package manager) and run this again."
fi
ok "Node.js $(node -v)"

# 2. Packages (from package.json / package-lock.json)
if [ -d node_modules/@modelcontextprotocol/sdk ] && [ -d node_modules/express ]; then
  ok "Packages already installed"
else
  echo "  Installing packages…"
  npm install --no-fund --no-audit
  ok "Packages installed"
fi

# 3. .env file
if [ -f .env ]; then
  ok ".env already exists"
else
  cp .env.example .env
  ok "Created .env from .env.example"
fi

# 4. Model key: the simulator's agent needs one provider
has_provider() { grep -Eq '^(GROQ_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY|LLM_PROVIDER)=.+' .env; }
if has_provider; then
  ok "Model provider is set in .env"
elif [ -t 0 ]; then
  echo
  echo "  The voice assistant needs a free Groq API key (no credit card)."
  echo "  Get one at https://console.groq.com/keys, then paste it below."
  printf "  Groq API key (press Enter to skip): "
  read -r GROQ_KEY
  if [ -n "$GROQ_KEY" ]; then
    GROQ_KEY="$GROQ_KEY" node -e '
      const fs = require("fs");
      let env = fs.readFileSync(".env", "utf8");
      const line = "GROQ_API_KEY=" + process.env.GROQ_KEY.trim();
      env = /^#?\s*GROQ_API_KEY=.*$/m.test(env) ? env.replace(/^#?\s*GROQ_API_KEY=.*$/m, line) : env + "\n" + line + "\n";
      fs.writeFileSync(".env", env);'
    ok "Saved the Groq key in .env"
  else
    warn "Skipped. Add GROQ_API_KEY to .env later, or set LLM_PROVIDER=ollama to use a local model."
  fi
else
  warn "No model key in .env yet. Add GROQ_API_KEY=... to .env (free key: https://console.groq.com/keys)."
fi


# 5. Start HomeKeeper and open it in the browser
HK_PORT=$(grep -E '^PORT=[0-9]+' .env | cut -d= -f2 || true)
URL="http://localhost:${HK_PORT:-8787}"
if [ "$1" = "--no-start" ]; then
  echo
  echo "All set. Start HomeKeeper with: npm start, then open $URL in Chrome or Edge."
  exit 0
fi
open_browser() {
  if command -v open >/dev/null 2>&1 && [ "$(uname)" = "Darwin" ]; then open "$1"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$1" >/dev/null 2>&1
  else echo "  Open $1 in Chrome or Edge."; fi
}
if curl -s -o /dev/null "$URL/api/info" 2>/dev/null; then
  warn "HomeKeeper (or another app) is already running at $URL. Opening it in the browser."
  open_browser "$URL"
  exit 0
fi
# Open the browser in the background as soon as the server answers.
( for _ in $(seq 90); do curl -s -o /dev/null "$URL/api/info" && break; sleep 1; done; open_browser "$URL" ) &

echo
echo "Starting HomeKeeper at $URL"
echo "The browser will open by itself. Press Ctrl+C here to stop HomeKeeper."
echo
exec npm start
