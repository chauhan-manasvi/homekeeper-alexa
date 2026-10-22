// HTTP entry point: serves the HomeKeeper MCP server over Streamable HTTP at /mcp,
// the Alexa+ simulator web app at /, and the simulator's agent API at /api/chat.

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './mcp.js';
import { resetHousehold } from './store.js';
import { handleChat, resetChat, agentInfo, readUiResource } from '../agent/agent.js';

const PORT = Number(process.env.PORT || 8787);
const app = express();
app.use(express.json({ limit: '1mb' }));

// Stateless Streamable HTTP: each request gets a fresh server instance. Household
// state lives in the store, so nothing is lost between requests or sessions.
app.post('/mcp', async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP request failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  }
});

const methodNotAllowed = (_req, res) => {
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed: this server is stateless.' }, id: null });
};
app.get('/mcp', methodNotAllowed);
app.delete('/mcp', methodNotAllowed);

app.get('/api/info', (_req, res) => res.json(agentInfo()));

app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body || {};
  if (!sessionId || !message) return res.status(400).json({ error: 'sessionId and message are required' });
  try {
    res.json(await handleChat(sessionId, message, `http://127.0.0.1:${PORT}/mcp`));
  } catch (err) {
    console.error('Chat failed:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ui-resource', async (req, res) => {
  try {
    const content = await readUiResource(String(req.query.sessionId), String(req.query.uri), `http://127.0.0.1:${PORT}/mcp`);
    res.type('html').send(content.text);
  } catch (err) {
    res.status(404).send(err.message);
  }
});

app.post('/api/reset', (req, res) => {
  resetChat(req.body?.sessionId);
  if (req.body?.resetHome) resetHousehold(process.env.HOMEKEEPER_HOUSEHOLD || 'demo-home');
  res.json({ ok: true });
});

app.use(express.static(path.resolve('web')));

app.listen(PORT, () => {
  console.log(`HomeKeeper MCP server:   http://localhost:${PORT}/mcp`);
  console.log(`Alexa+ simulator:      http://localhost:${PORT}/`);
});

// HTTPS for other devices on the network. Browsers only allow the microphone on
// HTTPS or localhost, so http://<lan-ip> can't use voice. A self-signed certificate
// is created on first run; set HTTPS_PORT=0 to turn this off.
const HTTPS_PORT = Number(process.env.HTTPS_PORT ?? 8443);
const lanIps = Object.values(os.networkInterfaces()).flat()
  .filter((a) => a && a.family === 'IPv4' && !a.internal)
  .map((a) => a.address);

function loadCertificate() {
  const dir = path.resolve('.certs');
  const keyFile = path.join(dir, 'key.pem');
  const certFile = path.join(dir, 'cert.pem');
  const san = ['DNS:localhost', 'IP:127.0.0.1', ...lanIps.map((ip) => `IP:${ip}`)].join(',');
  const sanFile = path.join(dir, 'san.txt');
  // Regenerate when the network addresses change, e.g. on a different Wi-Fi.
  if (!fs.existsSync(certFile) || !fs.existsSync(sanFile) || fs.readFileSync(sanFile, 'utf8') !== san) {
    fs.mkdirSync(dir, { recursive: true });
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '825',
      '-keyout', keyFile, '-out', certFile, '-subj', '/CN=HomeKeeper', '-addext', `subjectAltName=${san}`],
      { stdio: 'ignore' });
    fs.writeFileSync(sanFile, san);
  }
  return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
}

if (HTTPS_PORT) {
  try {
    https.createServer(loadCertificate(), app).listen(HTTPS_PORT, () => {
      for (const ip of lanIps) console.log(`On other devices:      https://${ip}:${HTTPS_PORT}/`);
    });
  } catch (err) {
    console.warn(`HTTPS not started (${err.message}). Voice from other devices needs openssl.`);
  }
}
