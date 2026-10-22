// Agent behind the Alexa+ simulator. It connects to the HomeKeeper MCP server as a
// real MCP client over Streamable HTTP, hands the server's tools to an LLM, and
// runs the tool-use loop. Tool results that carry an MCP Apps card are passed
// back to the browser to render.
//
// Providers:
//   groq, gemini, ollama  free options, through their OpenAI-compatible chat API
//   anthropic, bedrock    Claude via the Claude API or Amazon Bedrock

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const OPENAI_COMPATIBLE = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', keyEnv: 'GROQ_API_KEY', model: 'openai/gpt-oss-120b', label: 'Groq' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyEnv: 'GEMINI_API_KEY', model: 'gemini-2.5-flash', label: 'Google Gemini' },
  ollama: { baseUrl: 'http://localhost:11434/v1', keyEnv: null, model: 'qwen2.5:3b', label: 'Ollama (local)' },
};

function pickProvider() {
  if (process.env.LLM_PROVIDER) return process.env.LLM_PROVIDER;
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.AWS_REGION) return 'bedrock';
  return 'ollama';
}

const PROVIDER = pickProvider();
const PRESET = OPENAI_COMPATIBLE[PROVIDER];
const MODEL = process.env.LLM_MODEL || PRESET?.model || (PROVIDER === 'bedrock' ? 'anthropic.claude-opus-5-5' : 'claude-opus-5-5');
const EFFORT = process.env.LLM_EFFORT || 'low';
const MAX_TOOL_ROUNDS = 8;

const SYSTEM = `You are Alexa, a warm and efficient voice assistant in an Indian home, with the HomeKeeper skill connected for appliance care.
Your replies are spoken aloud on an Echo Show: one to three short sentences, no markdown, no lists, no emojis. Say prices like "399 rupees".
If the user only greets you (like "hello" or "hi Alexa"), just greet them back and ask how you can help today, in one short sentence. Do not call any tools or mention appliances until they ask for something.
The screen shows a card for most tool results, so you do not need to read every detail; mention the key facts and what the user can say next.
When a user reports a problem, check the home first if you have not yet, then troubleshoot and guide one DIY step at a time. Only suggest a technician once the user says the DIY step did not help, or when the guide says a technician is needed or there is a safety issue.
Before booking or buying anything, read back the price and slot or plan and wait for a clear yes. Use the user's own words as the appliance reference when unsure.
Always use the tools for facts about the home, prices, slots and bookings. Never make them up.`;

const sessions = new Map();

async function connect(mcpUrl, householdId) {
  const client = new Client({ name: 'homekeeper-alexa-simulator', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    requestInit: { headers: { 'x-homekeeper-household': householdId } },
  });
  await client.connect(transport);
  const { tools } = await client.listTools();
  return { client, tools };
}

async function getSession(sessionId, mcpUrl) {
  let s = sessions.get(sessionId);
  if (!s) {
    const { client, tools } = await connect(mcpUrl, process.env.HOMEKEEPER_HOUSEHOLD || 'demo-home');
    const usable = tools.filter(t => t.name !== 'reset_demo_home');
    s = {
      client,
      mcpTools: tools,
      tools: PRESET
        ? usable.map(t => {
          // Some OpenAI-compatible endpoints reject the JSON Schema "$schema" key.
          const { $schema, ...parameters } = t.inputSchema;
          return { type: 'function', function: { name: t.name, description: t.description, parameters } };
        })
        : usable.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema })),
      messages: PRESET ? [{ role: 'system', content: SYSTEM }] : [],
    };
    sessions.set(sessionId, s);
  }
  return s;
}

export function resetChat(sessionId) {
  const s = sessions.get(sessionId);
  if (s) s.client.close().catch(() => {});
  sessions.delete(sessionId);
}

export function agentInfo() {
  return { provider: PROVIDER, providerLabel: PRESET?.label || (PROVIDER === 'bedrock' ? 'Amazon Bedrock' : 'Claude API'), model: MODEL };
}

// Calls one MCP tool and records anything the simulator should show.
async function runTool(s, name, input, cards, trace) {
  trace.push({ tool: name, input });
  try {
    const res = await s.client.callTool({ name, arguments: input });
    const uri = s.mcpTools.find(t => t.name === name)?._meta?.ui?.resourceUri;
    if (uri && res.structuredContent && !res.isError) {
      cards.push({ tool: name, resourceUri: uri, input, result: res });
    }
    return { text: res.content.filter(c => c.type === 'text').map(c => c.text).join('\n'), isError: Boolean(res.isError) };
  } catch (err) {
    return { text: `Tool failed: ${err.message}`, isError: true };
  }
}

async function chatCompletion(s) {
  const headers = { 'content-type': 'application/json' };
  if (PRESET.keyEnv) {
    const key = process.env[PRESET.keyEnv];
    if (!key) throw new Error(`${PRESET.keyEnv} is not set in .env`);
    headers.authorization = `Bearer ${key}`;
  }
  // Free tiers have tight per-minute limits, so wait and retry on 429 instead of failing the turn.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${process.env.LLM_BASE_URL || PRESET.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: MODEL, messages: s.messages, tools: s.tools, tool_choice: 'auto', temperature: 0.3 }),
    });
    if (res.ok) return (await res.json()).choices[0].message;
    const body = await res.text();
    if (res.status === 429 && attempt < 4) {
      const hinted = Number(res.headers.get('retry-after')) || Number(body.match(/try again in ([\d.]+)s/)?.[1]);
      await new Promise(r => setTimeout(r, Math.min(30, (hinted || 5) + 1) * 1000));
      continue;
    }
    throw new Error(`${PRESET.label} returned ${res.status}: ${body.slice(0, 300)}`);
  }
}

async function handleOpenAICompatible(s, cards, trace) {
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const msg = await chatCompletion(s);
    s.messages.push({ role: 'assistant', content: msg.content ?? '', ...(msg.tool_calls?.length ? { tool_calls: msg.tool_calls } : {}) });
    if (!msg.tool_calls?.length) return (msg.content || '').trim() || 'Okay.';
    for (const call of msg.tool_calls) {
      let input = {};
      try {
        input = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        s.messages.push({ role: 'tool', tool_call_id: call.id, content: 'Error: arguments were not valid JSON. Try again.' });
        continue;
      }
      const out = await runTool(s, call.function.name, input, cards, trace);
      s.messages.push({ role: 'tool', tool_call_id: call.id, content: out.isError ? `Error: ${out.text}` : out.text });
    }
  }
  return 'Sorry, that took too many steps. Could you say that again?';
}

let claude = null;
async function getClaude() {
  if (!claude) {
    if (PROVIDER === 'bedrock') {
      const { AnthropicBedrockMantle } = await import('@anthropic-ai/bedrock-sdk');
      claude = new AnthropicBedrockMantle();
    } else {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      claude = new Anthropic();
    }
  }
  return claude;
}

async function handleClaude(s, cards, trace) {
  const client = await getClaude();
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const params = {
      model: MODEL,
      max_tokens: 16000,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: s.tools,
      messages: s.messages,
      output_config: { effort: EFFORT },
    };
    // Server-side refusal fallback is a Claude API feature; Bedrock does not take it.
    const response = PROVIDER === 'anthropic'
      ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await client.messages.create(params);
    // Keep the full content (including thinking blocks) so the history stays valid.
    s.messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'refusal') return "Sorry, I can't help with that one.";
    if (response.stop_reason !== 'tool_use') {
      return response.content.filter(b => b.type === 'text').map(b => b.text).join(' ').trim() || 'Okay.';
    }
    const calls = response.content.filter(b => b.type === 'tool_use');
    const results = await Promise.all(calls.map(async call => {
      const out = await runTool(s, call.name, call.input, cards, trace);
      return { type: 'tool_result', tool_use_id: call.id, content: out.text, is_error: out.isError };
    }));
    s.messages.push({ role: 'user', content: results });
  }
  return 'Sorry, that took too many steps. Could you say that again?';
}

export async function handleChat(sessionId, message, mcpUrl) {
  const s = await getSession(sessionId, mcpUrl);
  s.messages.push({ role: 'user', content: message });
  const cards = [];
  const trace = [];
  const reply = PRESET ? await handleOpenAICompatible(s, cards, trace) : await handleClaude(s, cards, trace);
  return { reply, cards, trace };
}

// Reads an MCP Apps UI resource through MCP, so the simulator renders exactly
// what the server published.
export async function readUiResource(sessionId, uri, mcpUrl) {
  const s = await getSession(sessionId, mcpUrl);
  const res = await s.client.readResource({ uri });
  return res.contents[0];
}
