#!/usr/bin/env bash
# One-step setup for HomeKeeper on Linux and macOS.
# Checks Node.js, installs packages if needed, creates .env and asks for a free Groq key.
# Usage: ./setup.sh   (or: bash setup.sh)

set -e
cd "$(dirname "$0")"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; exit 1; }

echo "HomeKeeper setup"
echo

# 1. Node.js 20 or newer
if ! command -v node >/dev/null 2>&1; then
  fail "Node.js is not installed. Install Node.js 20 or newer from https://nodejs.org and run this again."
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node.js $(node -v) is too old. Install Node.js 20 or newer from https://nodejs.org and run this again."
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

echo
echo "All set. Start HomeKeeper with:"
echo
echo "  npm start"
echo
echo "Then open http://localhost:8787 in Chrome or Edge."
