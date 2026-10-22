// End-to-end smoke test: talks to a running HomeKeeper server over Streamable HTTP
// as an MCP client and walks the full troubleshoot → quote → book → track flow.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = process.env.MCP_URL || 'http://localhost:8787/mcp';
const client = new Client({ name: 'homekeeper-smoke', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { 'x-homekeeper-household': 'smoke-test' } } }));

const call = async (name, args = {}, expectError = false) => {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content[0].text.split('\n\n')[0];
  const ok = Boolean(res.isError) === expectError;
  console.log(`${ok ? '✓' : '✗'} ${name}: ${text}`);
  if (!ok) process.exitCode = 1;
  return res.structuredContent;
};

console.log('protocol', client.getServerVersion(), 'instructions:', Boolean(client.getInstructions()));
const { tools } = await client.listTools();
console.log('tools:', tools.map(t => t.name + (t._meta?.ui ? '[ui]' : '')).join(', '));
const { resources } = await client.listResources();
console.log('resources:', resources.map(r => `${r.uri} (${r.mimeType})`).join(', '));

await call('reset_demo_home');
await call('get_home_overview');
await call('troubleshoot_appliance', { appliance: 'bedroom AC', symptom: 'not cooling properly' });
const q = await call('get_service_quote', { appliance: 'bedroom AC', issue: 'AC not cooling', service_type: 'repair' });
await call('book_service', { quote_id: q.quoteId, slot_id: q.slots[0].id, confirm: false });
const b = await call('book_service', { quote_id: q.quoteId, slot_id: q.slots[0].id, confirm: true });
await call('track_booking', {});
await call('manage_booking', { booking_id: b.bookingId, action: 'reschedule' });
const o = await call('buy_care_plan', { plan: 'complete', appliances: ['all'] });
await call('buy_care_plan', { order_id: o.orderId, confirm: true });
await call('get_service_quote', { appliance: 'the fridge', issue: 'making noise' });
await call('troubleshoot_appliance', { appliance: 'geyser', symptom: 'no hot water' });
await call('add_appliance', { type: 'microwave', brand: 'IFB', location: 'Kitchen', purchase_date: '2026-02-01' });
await call('troubleshoot_appliance', { appliance: 'dishwasher', symptom: 'broken' }, true);
const card = await client.readResource({ uri: 'ui://homekeeper/card.html' });
console.log('card resource:', card.contents[0].mimeType, card.contents[0].text.length, 'bytes');
await call('reset_demo_home');
await client.close();
