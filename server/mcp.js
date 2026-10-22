// HomeKeeper MCP server definition: tools, MCP Apps UI resource, data resource
// and prompt. Transport wiring lives in index.js.

import fs from 'node:fs';
import path from 'node:path';
import * as z from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getHousehold, updateHousehold, resetHousehold } from './store.js';
import * as gc from './homekeeper.js';

export const CARD_URI = 'ui://homekeeper/card.html';
const CARD_MIME = 'text/html;profile=mcp-app';
const CARD_FILE = path.resolve('web/card.html');

// Attaches the MCP Apps card to a tool so hosts that support MCP Apps render it.
const cardMeta = { ui: { resourceUri: CARD_URI }, 'ui/resourceUri': CARD_URI };

const INSTRUCTIONS = `HomeKeeper looks after the appliances in a user's home (AC, fridge, washing machine, RO purifier, geyser, microwave).
You are speaking through a voice assistant: keep replies short and conversational, one or two sentences, and read prices in rupees.
Typical flow: get_home_overview to know the home → troubleshoot_appliance for a problem (walk the user through the DIY steps one at a time before suggesting a visit, and always say safety warnings first) → get_service_quote → read out the price and two or three slots → book_service only after the user explicitly agrees → track_booking.
Never call book_service or buy_care_plan with confirm=true unless the user has clearly said yes to that exact price and slot or plan.
Proactively mention overdue maintenance from get_home_overview when it is relevant.`;

function householdId(extra) {
  const h = extra?.requestInfo?.headers?.['x-homekeeper-household'];
  return (Array.isArray(h) ? h[0] : h) || 'demo-home';
}

function result(text, structured) {
  return { content: [{ type: 'text', text: `${text}\n\n${JSON.stringify(structured)}` }], structuredContent: structured };
}

function failure(text) {
  return { content: [{ type: 'text', text }], isError: true };
}

function withAppliance(hh, ref) {
  const a = gc.resolveAppliance(hh, ref);
  if (!a) {
    const known = hh.appliances.map(x => `${x.id} (${gc.describeAppliance(x)})`).join('; ');
    throw new Error(`I couldn't find an appliance matching "${ref}". Known appliances: ${known}`);
  }
  return a;
}

// Wraps a handler so domain errors come back as tool errors the model can recover from.
const safe = fn => async (args, extra) => {
  try {
    return await fn(args, extra);
  } catch (err) {
    return failure(err.message);
  }
};

export function createServer() {
  const server = new McpServer(
    { name: 'homekeeper', title: 'HomeKeeper: home appliance care', version: '1.0.0' },
    { capabilities: { logging: {} }, instructions: INSTRUCTIONS },
  );

  const applianceRef = z.string().describe('Appliance id from get_home_overview, or a spoken description such as "bedroom AC" or "the fridge"');

  server.registerTool('get_home_overview', {
    title: 'Home overview',
    description: 'List every appliance in the home with warranty status, maintenance due dates, active care plans, upcoming technician bookings and anything that needs attention. Call this first in a conversation.',
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: cardMeta,
  }, safe(async (_args, extra) => {
    const view = gc.homeOverview(getHousehold(householdId(extra)));
    const attention = view.attention.length ? ` Needs attention: ${view.attention.map(a => `${a.name}, ${a.reason}`).join('; ')}.` : '';
    return result(`${view.household.name} in ${view.household.city} has ${view.appliances.length} appliances.${attention}`, view);
  }));

  server.registerTool('add_appliance', {
    title: 'Add appliance',
    description: 'Register a new appliance in the home so HomeKeeper can track its warranty and maintenance.',
    inputSchema: {
      type: z.enum(gc.APPLIANCE_TYPES).describe('Appliance category'),
      brand: z.string().describe('Brand, e.g. Voltas, LG, Samsung'),
      model: z.string().optional().describe('Model or capacity, e.g. "1.5 Ton split"'),
      location: z.string().optional().describe('Room, e.g. "Kids bedroom"'),
      purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Purchase date, YYYY-MM-DD'),
      last_service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Last service date, YYYY-MM-DD'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, safe(async (args, extra) => {
    const a = updateHousehold(householdId(extra), hh => gc.addAppliance(hh, args));
    return result(`Added ${a.name}. Warranty ${a.warranty.inWarranty ? `valid until ${a.warranty.warrantyEnds}` : 'has ended'}; next service due ${a.maintenance.dueDate}.`, { kind: 'appliance', appliance: a });
  }));

  server.registerTool('troubleshoot_appliance', {
    title: 'Troubleshoot appliance',
    description: 'Diagnose a problem the user describes. Returns safety warnings, ordered DIY checks the user can try right now, likely causes, warranty position and whether this is a repeat issue. The issue is saved to the appliance history.',
    inputSchema: {
      appliance: applianceRef,
      symptom: z.string().describe('What the user says is wrong, in their words, e.g. "not cooling", "leaking water"'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    _meta: cardMeta,
  }, safe(async ({ appliance, symptom }, extra) => {
    const view = updateHousehold(householdId(extra), hh => gc.troubleshoot(hh, withAppliance(hh, appliance), symptom));
    const lead = view.safety ? `Safety first: ${view.safety} ` : '';
    return result(`${lead}${view.title}. Suggest DIY step 1 first: ${view.diySteps[0]}`, view);
  }));

  server.registerTool('get_service_quote', {
    title: 'Get service quote',
    description: 'Price a technician visit for an appliance, applying manufacturer warranty, extended part warranty and any HomeKeeper plan, and return available time slots. Use for repairs or routine maintenance.',
    inputSchema: {
      appliance: applianceRef,
      issue: z.string().describe('Short description of the job, e.g. "AC not cooling" or "routine service"'),
      service_type: z.enum(['repair', 'routine_service']).default('repair'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    _meta: cardMeta,
  }, safe(async ({ appliance, issue, service_type }, extra) => {
    const view = updateHousehold(householdId(extra), hh => gc.createQuote(hh, withAppliance(hh, appliance), issue, service_type));
    return result(`Quote ${view.quoteId}: ₹${view.total} upfront. ${view.notes.join(' ')} First slots: ${view.slots.slice(0, 3).map(s => s.label).join('; ')}.`, view);
  }));

  server.registerTool('book_service', {
    title: 'Book technician',
    description: 'Book a technician for a quoted job. Call with confirm=false to get the summary to read back; call again with confirm=true only after the user explicitly agrees.',
    inputSchema: {
      quote_id: z.string().describe('quoteId from get_service_quote'),
      slot_id: z.string().describe('Slot id from the quote'),
      confirm: z.boolean().default(false).describe('true only after the user said yes to this price and slot'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    _meta: cardMeta,
  }, safe(async ({ quote_id, slot_id, confirm }, extra) => {
    const id = householdId(extra);
    if (!confirm) {
      const hh = getHousehold(id);
      const q = hh.quotes[quote_id];
      if (!q) return failure(`Quote ${quote_id} not found or already booked. Get a new quote.`);
      const slot = q.slots.find(s => s.id === slot_id);
      if (!slot) return failure(`Slot ${slot_id} is not on this quote. Options: ${q.slots.map(s => `${s.id} (${s.label})`).join(', ')}`);
      return result(`Ask the user to confirm: book ${gc.describeAppliance(hh.appliances.find(a => a.id === q.applianceId))} for "${q.issue}" on ${slot.label}, ₹${q.total} upfront?`, { kind: 'confirm', quoteId: quote_id, slotId: slot_id, slot, total: q.total });
    }
    const view = updateHousehold(id, hh => gc.bookService(hh, quote_id, slot_id));
    return result(`Booked. ${view.technician.name} (rated ${view.technician.rating}) will come ${view.slot.label}. Share OTP ${view.otp} with the technician on arrival. ${view.payment}.`, view);
  }));

  server.registerTool('track_booking', {
    title: 'Track booking',
    description: 'Live status of a technician booking: who is coming, when, ETA and the visit OTP. Defaults to the latest active booking.',
    inputSchema: { booking_id: z.string().optional() },
    annotations: { readOnlyHint: true, openWorldHint: true },
    _meta: cardMeta,
  }, safe(async ({ booking_id }, extra) => {
    const hh = getHousehold(householdId(extra));
    const b = gc.findBooking(hh, booking_id);
    if (!b) return failure('There are no active bookings.');
    const view = { kind: 'booking', ...gc.bookingView(hh, b) };
    return result(view.live?.message || `Booking ${b.id} is ${b.status}.`, view);
  }));

  server.registerTool('manage_booking', {
    title: 'Reschedule or cancel booking',
    description: 'Reschedule a booking to another slot or cancel it. For reschedule without slot_id, returns available slots to offer.',
    inputSchema: {
      booking_id: z.string().optional().describe('Defaults to the latest active booking'),
      action: z.enum(['reschedule', 'cancel']),
      slot_id: z.string().optional().describe('New slot id when rescheduling'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    _meta: cardMeta,
  }, safe(async ({ booking_id, action, slot_id }, extra) => {
    const view = updateHousehold(householdId(extra), hh => {
      const b = gc.findBooking(hh, booking_id);
      if (!b) throw new Error('There are no active bookings.');
      if (action === 'cancel') {
        b.status = 'cancelled';
        return { kind: 'booking', ...gc.bookingView(hh, b) };
      }
      return gc.rescheduleBooking(hh, b, slot_id);
    });
    const text = view.kind === 'slots' ? `Available slots: ${view.slots.map(s => s.label).join('; ')}.` : view.status === 'cancelled' ? `Booking ${view.bookingId} cancelled. No charge.` : `Moved to ${view.slot.label} with ${view.technician.name}.`;
    return result(text, view);
  }));

  server.registerTool('buy_care_plan', {
    title: 'Buy HomeKeeper plan',
    description: 'Purchase an annual HomeKeeper maintenance plan (AMC) for one or more appliances. Step 1: call with plan and appliances (confirm=false) to create an order and read the price to the user. Step 2: after an explicit yes, call with order_id and confirm=true to pay. Plans: basic (₹999/appliance: 2 services, free visits) and complete (₹2499/appliance: unlimited breakdown visits, labour covered, priority slots). 10% off for 3+ appliances.',
    inputSchema: {
      plan: z.enum(['basic', 'complete']).optional(),
      appliances: z.array(applianceRef).optional().describe('Appliances to cover; use ["all"] for every appliance'),
      order_id: z.string().optional().describe('Order to pay for, from step 1'),
      confirm: z.boolean().default(false),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    _meta: cardMeta,
  }, safe(async ({ plan, appliances, order_id, confirm }, extra) => {
    const id = householdId(extra);
    if (confirm) {
      if (!order_id) return failure('order_id is required to confirm. Create the order first with confirm=false.');
      const view = updateHousehold(id, hh => gc.confirmCarePlan(hh, order_id));
      return result(`${view.planName} is active until ${view.validUntil} for ${view.appliances.join(', ')}. ${view.payment}`, view);
    }
    if (!plan || !appliances?.length) return failure('Provide plan and appliances to create an order.');
    const view = updateHousehold(id, hh => {
      const list = appliances.length === 1 && appliances[0].toLowerCase() === 'all' ? hh.appliances : appliances.map(r => withAppliance(hh, r));
      return gc.carePlanOrder(hh, plan, [...new Set(list)]);
    });
    const discount = view.discountPct ? ` after ${view.discountPct}% multi-appliance discount` : '';
    return result(`Ask the user to confirm: ${view.planName} for ${view.appliances.length} appliance(s), ₹${view.total} per year${discount}. Order ${view.orderId}.`, view);
  }));

  server.registerTool('reset_demo_home', {
    title: 'Reset demo home',
    description: 'Restore the demo household to its starting state. Only use when the user asks to reset the demo.',
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, safe(async (_args, extra) => {
    resetHousehold(householdId(extra));
    return result('Demo home reset.', { kind: 'reset' });
  }));

  // MCP Apps UI: one card that renders whichever tool result it is attached to.
  server.registerResource('homekeeper-card', CARD_URI, {
    title: 'HomeKeeper card',
    description: 'Interactive card for home overview, diagnosis, quotes, bookings and plan orders',
    mimeType: CARD_MIME,
  }, async () => ({
    contents: [{ uri: CARD_URI, mimeType: CARD_MIME, text: fs.readFileSync(CARD_FILE, 'utf8'), _meta: { ui: { prefersBorder: false } } }],
  }));

  server.registerResource('home-profile', 'homekeeper://home/profile', {
    title: 'Home appliance profile',
    description: 'Current appliances, warranty and maintenance state for the household',
    mimeType: 'application/json',
  }, async (uri, extra) => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(gc.homeOverview(getHousehold(householdId(extra))), null, 2) }],
  }));

  server.registerPrompt('seasonal_checkup', {
    title: 'Seasonal home check-up',
    description: 'Review the home, find overdue or seasonal maintenance and offer to book it',
  }, () => ({
    messages: [{ role: 'user', content: { type: 'text', text: 'Do a seasonal check-up of my home appliances. Tell me what is overdue or worth servicing this season, and offer to book the most important one.' } }],
  }));

  return server;
}
