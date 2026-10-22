// HomeKeeper domain logic: warranty checks, maintenance planning, troubleshooting,
// quotes, technician booking and care-plan purchases. Pure functions over a
// household object; persistence is handled by the caller through store.js.

import { LABELS, SHORT, WARRANTY, MAINTENANCE, PRICING, CARE_PLANS, APPLIANCE_TYPES, findGuide } from './knowledge.js';
import { newId } from './store.js';

const TECHNICIANS = [
  { name: 'Ramesh Solanki', rating: 4.8, jobs: 1240, skills: ['ac', 'refrigerator'] },
  { name: 'Imran Shaikh', rating: 4.9, jobs: 2015, skills: ['ac', 'refrigerator', 'microwave'] },
  { name: 'Kiran Desai', rating: 4.7, jobs: 860, skills: ['washing_machine', 'microwave', 'geyser'] },
  { name: 'Suresh Parmar', rating: 4.8, jobs: 1530, skills: ['water_purifier', 'geyser', 'washing_machine'] },
];

const SLOT_WINDOWS = [
  { start: '10:00', end: '12:00' },
  { start: '13:00', end: '15:00' },
  { start: '16:00', end: '18:00' },
];

// Lets a demo pin "today" so recorded walkthroughs are reproducible.
export function today() {
  return process.env.HOMEKEEPER_TODAY ? new Date(`${process.env.HOMEKEEPER_TODAY}T09:00:00`) : new Date();
}

const iso = d => d.toISOString().slice(0, 10);

function addMonths(dateStr, months) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatDate(d) {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function describeAppliance(a) {
  return `${a.location} ${SHORT[a.type]} (${a.brand})`;
}

// Matches an appliance by id, or by words like "bedroom AC" or "the fridge".
export function resolveAppliance(household, ref) {
  if (!ref) return null;
  const exact = household.appliances.find(a => a.id === ref);
  if (exact) return exact;
  const words = ref.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const aliases = {
    ac: ['ac', 'air', 'conditioner', 'aircon'],
    refrigerator: ['fridge', 'refrigerator', 'freezer'],
    washing_machine: ['washing', 'washer', 'machine'],
    water_purifier: ['ro', 'purifier', 'water', 'filter'],
    geyser: ['geyser', 'heater', 'boiler'],
    microwave: ['microwave', 'oven'],
  };
  let best = null;
  let bestScore = 0;
  for (const a of household.appliances) {
    const hay = `${a.location} ${a.brand} ${a.model}`.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (aliases[a.type].includes(w)) score += 3;
      else if (w.length > 2 && hay.includes(w)) score += 2;
    }
    if (score > bestScore) {
      best = a;
      bestScore = score;
    }
  }
  return bestScore >= 3 ? best : null;
}

export function warrantyStatus(a, now = today()) {
  const terms = WARRANTY[a.type];
  const generalEnd = addMonths(a.purchaseDate, terms.months);
  const status = {
    inWarranty: generalEnd > now,
    warrantyEnds: iso(generalEnd),
    extended: null,
  };
  if (terms.extended) {
    const extEnd = addMonths(a.purchaseDate, terms.extended.months);
    status.extended = { part: terms.extended.part, covered: extEnd > now, ends: iso(extEnd) };
  }
  return status;
}

export function maintenanceStatus(a, now = today()) {
  const rule = MAINTENANCE[a.type];
  const base = a.lastServiceDate || a.purchaseDate;
  const due = addMonths(base, rule.everyMonths);
  const daysUntil = Math.round((due - now) / 86400000);
  const inSeason = rule.season?.includes(now.getMonth() + 1) ?? false;
  return {
    task: rule.task,
    dueDate: iso(due),
    daysUntil,
    state: daysUntil < 0 ? 'overdue' : daysUntil <= 30 ? 'due_soon' : 'ok',
    seasonalNote: inSeason ? rule.seasonNote : null,
  };
}

function carePlanActive(a, now = today()) {
  return a.carePlan && new Date(`${a.carePlan.validUntil}T23:59:59`) > now ? a.carePlan : null;
}

export function applianceSummary(a) {
  return {
    id: a.id,
    name: describeAppliance(a),
    type: a.type,
    typeLabel: LABELS[a.type],
    brand: a.brand,
    model: a.model,
    location: a.location,
    purchaseDate: a.purchaseDate,
    lastServiceDate: a.lastServiceDate,
    warranty: warrantyStatus(a),
    maintenance: maintenanceStatus(a),
    carePlan: carePlanActive(a),
  };
}

export function homeOverview(household) {
  const appliances = household.appliances.map(applianceSummary);
  const attention = appliances
    .filter(a => a.maintenance.state !== 'ok' || a.maintenance.seasonalNote)
    .map(a => ({ id: a.id, name: a.name, reason: a.maintenance.state === 'overdue' ? `service overdue since ${a.maintenance.dueDate}` : a.maintenance.state === 'due_soon' ? `service due on ${a.maintenance.dueDate}` : a.maintenance.seasonalNote, task: a.maintenance.task }));
  const activeBookings = household.bookings.filter(b => b.status === 'confirmed').map(b => bookingView(household, b));
  return { kind: 'home', household: { name: household.name, city: household.city }, appliances, attention, activeBookings, recentIssues: household.issues.slice(-3).reverse() };
}

export function addAppliance(household, input) {
  const appliance = {
    id: newId(input.type.replace('_', '')),
    type: input.type,
    brand: input.brand,
    model: input.model || '',
    location: input.location || 'Home',
    purchaseDate: input.purchase_date,
    lastServiceDate: input.last_service_date || null,
    carePlan: null,
  };
  household.appliances.push(appliance);
  return applianceSummary(appliance);
}

export function troubleshoot(household, appliance, symptom) {
  const guide = findGuide(appliance.type, symptom);
  const warranty = warrantyStatus(appliance);
  const issue = {
    id: newId('issue'),
    applianceId: appliance.id,
    symptom,
    guideId: guide?.id || null,
    reportedAt: today().toISOString(),
  };
  household.issues.push(issue);
  const priorIssues = household.issues.filter(i => i.applianceId === appliance.id && i.id !== issue.id);
  return {
    kind: 'troubleshoot',
    issueId: issue.id,
    appliance: applianceSummary(appliance),
    matched: Boolean(guide),
    title: guide?.title || `${LABELS[appliance.type]}: ${symptom}`,
    safety: guide?.safety || null,
    diySteps: guide?.diy || ['Switch the appliance off and on again at the wall socket.', 'Check the power supply and MCB.'],
    likelyCauses: guide?.causes || [],
    technicianLikely: guide ? guide.technicianLikely : true,
    warranty,
    repeatIssue: priorIssues.length > 0 ? { count: priorIssues.length, last: priorIssues.at(-1).symptom } : null,
  };
}

function slotsFor(type, priority, now = today()) {
  const slots = [];
  for (let day = 0; day < 3; day++) {
    const d = new Date(now);
    d.setDate(d.getDate() + day);
    SLOT_WINDOWS.forEach((w, i) => {
      // Same-day slots after the current hour are gone; others are thinned
      // deterministically so availability looks realistic.
      if (day === 0 && Number(w.start.slice(0, 2)) <= now.getHours() + 1) return;
      const taken = (d.getDate() * 7 + i * 3 + type.length) % 4 === 0;
      if (taken && !priority) return;
      slots.push({ id: `${iso(d)}_${w.start.replace(':', '')}`, date: iso(d), label: `${day === 0 ? 'Today' : day === 1 ? 'Tomorrow' : formatDate(d)}, ${w.start}–${w.end}`, start: w.start, end: w.end });
    });
  }
  return slots.slice(0, 6);
}

export function createQuote(household, appliance, issue, serviceType) {
  const price = PRICING[appliance.type];
  const warranty = warrantyStatus(appliance);
  const plan = carePlanActive(appliance);
  const lines = [];
  const notes = [];

  if (serviceType === 'routine_service') {
    const covered = plan !== null;
    lines.push({ label: MAINTENANCE[appliance.type].task, amount: covered ? 0 : price.service });
    if (covered) notes.push(`Included in your ${CARE_PLANS[plan.plan].name} plan.`);
  } else {
    const visitFree = warranty.inWarranty || plan !== null;
    lines.push({ label: 'Technician visit and diagnosis', amount: visitFree ? 0 : price.visit });
    if (warranty.inWarranty) notes.push(`Under manufacturer warranty until ${warranty.warrantyEnds}: visit, labour and parts are free.`);
    else if (plan) notes.push(`Visit covered by your ${CARE_PLANS[plan.plan].name} plan.`);
    else notes.push(`General warranty ended on ${warranty.warrantyEnds}.`);
    if (!warranty.inWarranty && warranty.extended?.covered) {
      notes.push(`The ${warranty.extended.part} is still covered until ${warranty.extended.ends}, so if it is the cause, the part is free.`);
    }
    if (!warranty.inWarranty) {
      const labourCovered = plan?.plan === 'complete';
      notes.push(labourCovered ? 'Labour is covered by your plan; spare parts at 25% off.' : `Repairs, if needed, typically cost ₹${price.repairRange[0]}–₹${price.repairRange[1]} and are approved by you on-site before any work starts.`);
    }
  }

  const total = lines.reduce((n, l) => n + l.amount, 0);
  const quote = {
    id: newId('q'),
    applianceId: appliance.id,
    issue,
    serviceType,
    lines,
    total,
    notes,
    slots: slotsFor(appliance.type, plan?.plan === 'complete'),
    createdAt: today().toISOString(),
  };
  household.quotes[quote.id] = quote;

  const upsell = !plan && !warranty.inWarranty
    ? { plan: 'complete', name: CARE_PLANS.complete.name, price: CARE_PLANS.complete.pricePerAppliance, pitch: `For ₹${CARE_PLANS.complete.pricePerAppliance}/year, ${CARE_PLANS.complete.name} covers unlimited breakdown visits and labour for this appliance.` }
    : null;

  return { kind: 'quote', quoteId: quote.id, appliance: applianceSummary(appliance), issue, serviceType, lines, total, notes, slots: quote.slots, upsell };
}

function pickTechnician(type, seed) {
  const pool = TECHNICIANS.filter(t => t.skills.includes(type));
  return pool[seed.charCodeAt(seed.length - 1) % pool.length];
}

export function bookingView(household, b) {
  const appliance = household.appliances.find(a => a.id === b.applianceId);
  const view = {
    bookingId: b.id,
    status: b.status,
    appliance: appliance ? describeAppliance(appliance) : b.applianceId,
    issue: b.issue,
    slot: b.slot,
    technician: b.technician,
    otp: b.otp,
    amountDue: b.amountDue,
    payment: b.payment,
  };
  if (b.status === 'confirmed') {
    const now = today();
    if (b.slot.date === iso(now)) {
      const [h, m] = b.slot.start.split(':').map(Number);
      const start = new Date(now);
      start.setHours(h, m, 0, 0);
      const mins = Math.round((start - now) / 60000);
      view.live = mins <= 60
        ? { stage: 'on_the_way', etaMinutes: Math.max(10, mins), message: `${b.technician.name} is on the way, about ${Math.max(10, mins)} minutes away.` }
        : { stage: 'assigned', message: `${b.technician.name} will start towards you about 45 minutes before ${b.slot.start}.` };
    } else {
      view.live = { stage: 'scheduled', message: `${b.technician.name} is assigned for ${b.slot.label}. You'll get an SMS when they start.` };
    }
  }
  return view;
}

export function bookService(household, quoteId, slotId) {
  const quote = household.quotes[quoteId];
  if (!quote) throw new Error(`Quote ${quoteId} not found. Get a new quote first.`);
  const slot = quote.slots.find(s => s.id === slotId);
  if (!slot) throw new Error(`Slot ${slotId} is not available on quote ${quoteId}. Choose one of: ${quote.slots.map(s => s.id).join(', ')}`);
  const booking = {
    id: newId('bk'),
    quoteId,
    applianceId: quote.applianceId,
    issue: quote.issue,
    serviceType: quote.serviceType,
    slot,
    technician: pickTechnician(household.appliances.find(a => a.id === quote.applianceId).type, quoteId),
    otp: String(1000 + (parseInt(quoteId.slice(-4), 16) % 9000)),
    amountDue: quote.total,
    payment: quote.total === 0 ? 'No charge' : 'Pay after service (UPI, card or cash)',
    status: 'confirmed',
    createdAt: today().toISOString(),
  };
  household.bookings.push(booking);
  delete household.quotes[quoteId];
  return { kind: 'booking', ...bookingView(household, booking) };
}

export function findBooking(household, bookingId) {
  if (bookingId) return household.bookings.find(b => b.id === bookingId) || null;
  return household.bookings.filter(b => b.status === 'confirmed').at(-1) || null;
}

export function rescheduleBooking(household, booking, slotId) {
  const appliance = household.appliances.find(a => a.id === booking.applianceId);
  const slots = slotsFor(appliance.type, carePlanActive(appliance)?.plan === 'complete');
  const slot = slots.find(s => s.id === slotId);
  if (!slot) return { kind: 'slots', bookingId: booking.id, message: 'Pick one of these slots.', slots };
  booking.slot = slot;
  return { kind: 'booking', ...bookingView(household, booking) };
}

export function carePlanOrder(household, planKey, appliances) {
  const plan = CARE_PLANS[planKey];
  const order = {
    id: newId('ord'),
    plan: planKey,
    applianceIds: appliances.map(a => a.id),
    pricePerAppliance: plan.pricePerAppliance,
    // Multi-appliance discount: 10% off for 3 or more.
    discountPct: appliances.length >= 3 ? 10 : 0,
    status: 'pending_confirmation',
    createdAt: today().toISOString(),
  };
  order.subtotal = plan.pricePerAppliance * appliances.length;
  order.total = Math.round(order.subtotal * (1 - order.discountPct / 100));
  household.orders.push(order);
  return { kind: 'plan_order', orderId: order.id, status: order.status, planName: plan.name, includes: plan.includes, appliances: appliances.map(describeAppliance), pricePerAppliance: order.pricePerAppliance, subtotal: order.subtotal, discountPct: order.discountPct, total: order.total };
}

export function confirmCarePlan(household, orderId) {
  const order = household.orders.find(o => o.id === orderId);
  if (!order) throw new Error(`Order ${orderId} not found.`);
  if (order.status === 'paid') throw new Error(`Order ${orderId} is already paid.`);
  const validUntil = new Date(today());
  validUntil.setFullYear(validUntil.getFullYear() + 1);
  for (const id of order.applianceIds) {
    const a = household.appliances.find(x => x.id === id);
    if (a) a.carePlan = { plan: order.plan, orderId, validUntil: iso(validUntil) };
  }
  order.status = 'paid';
  order.paidAt = today().toISOString();
  const plan = CARE_PLANS[order.plan];
  return { kind: 'plan_order', orderId, status: 'paid', planName: plan.name, includes: plan.includes, appliances: order.applianceIds.map(id => describeAppliance(household.appliances.find(a => a.id === id))), total: order.total, validUntil: iso(validUntil), payment: 'Payment link sent by SMS to the registered mobile number (UPI). Plan is active immediately.' };
}

export { APPLIANCE_TYPES, CARE_PLANS };
