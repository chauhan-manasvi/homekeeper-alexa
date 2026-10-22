# Requirements

Everything you need to run HomeKeeper.

**You don't need to install these by hand.** On Windows, double-click `setup.bat`. It installs Node.js if it's missing, installs the packages, asks for a free Groq key, then starts HomeKeeper and opens it in your browser. On Linux and macOS, run `./setup.sh`, which does the same (on Linux, install Node.js 20+ first).

## Software

| What | Version | Why | Get it |
|---|---|---|---|
| Node.js | 20 or newer (includes npm) | Runs the MCP server, agent and simulator | Installed by `setup.bat` on Windows, or https://nodejs.org |
| Chrome or Edge | Any recent version | Voice input and speech output in the simulator. Other browsers work for typing only | https://www.google.com/chrome |
| Internet connection | | Chrome's speech recognition and the Groq model run online | |

## Model key (pick one)

Only the simulator's voice assistant needs a model. The MCP server itself needs no key.

| Option | Cost | What to put in `.env` |
|---|---|---|
| Groq (recommended) | Free, no card | `GROQ_API_KEY=...` from https://console.groq.com/keys |
| Google Gemini | Free tier | `GEMINI_API_KEY=...` from https://aistudio.google.com/apikey |
| Ollama | Free, runs offline | `LLM_PROVIDER=ollama`, after `ollama pull qwen2.5:3b` |
| Claude API | Paid | `ANTHROPIC_API_KEY=...` |
| Amazon Bedrock | Paid | `LLM_PROVIDER=bedrock` and `AWS_REGION`, with AWS credentials |

## Node packages

These are listed in `package.json` (exact versions are pinned in `package-lock.json`) and installed by `npm install` or the setup script. You don't need to install them one by one.

| Package | Used for |
|---|---|
| `@modelcontextprotocol/sdk` | MCP server and client (spec 2025-11-25, Streamable HTTP) |
| `express` | HTTP server for `/mcp`, the simulator and its API |
| `zod` | Tool input schemas |
| `dotenv` | Loads settings from `.env` |
| `@anthropic-ai/sdk` | Claude API provider (optional) |
| `@anthropic-ai/bedrock-sdk` | Amazon Bedrock provider (optional) |

## Hardware

- A microphone and speakers or headphones, for voice. You can also type instead.
- Port 8787 free on your machine. Set `PORT=` in `.env` to use another port.
