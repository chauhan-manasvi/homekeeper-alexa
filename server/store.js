// Persistent household state. Everything the agent learns about a home (its
// appliances, reported issues, quotes, bookings and plan purchases) is kept in a
// JSON file so it survives across conversations and server restarts.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { today } from './homekeeper.js';

const DATA_FILE = process.env.HOMEKEEPER_DATA_FILE || path.resolve('data/store.json');

// Demo dates are relative to "today" so the story stays the same whenever the
// demo runs: one AC just out of warranty, an overdue RO filter and a geyser due
// before winter.
function monthsAgo(months, days = 0) {
  const d = today();
  d.setMonth(d.getMonth() - months);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function seedHousehold(id) {
  return {
    id,
    name: 'Patel family',
    city: 'Ahmedabad',
    appliances: [
      { id: 'ac-bedroom', type: 'ac', brand: 'Voltas', model: '1.5 Ton 5-star inverter split', location: 'Master bedroom', purchaseDate: monthsAgo(18), lastServiceDate: monthsAgo(4), carePlan: null },
      { id: 'ac-living', type: 'ac', brand: 'LG', model: '1.5 Ton dual inverter split', location: 'Living room', purchaseDate: monthsAgo(41), lastServiceDate: monthsAgo(3), carePlan: null },
      { id: 'fridge-kitchen', type: 'refrigerator', brand: 'Samsung', model: '324L frost-free double door', location: 'Kitchen', purchaseDate: monthsAgo(50), lastServiceDate: monthsAgo(5), carePlan: null },
      { id: 'wm-utility', type: 'washing_machine', brand: 'Bosch', model: '7kg front load', location: 'Utility area', purchaseDate: monthsAgo(11), lastServiceDate: monthsAgo(3), carePlan: null },
      { id: 'ro-kitchen', type: 'water_purifier', brand: 'Kent', model: 'Grand Plus RO+UV', location: 'Kitchen', purchaseDate: monthsAgo(45), lastServiceDate: monthsAgo(7, 10), carePlan: null },
      { id: 'geyser-bath', type: 'geyser', brand: 'Racold', model: '15L storage', location: 'Main bathroom', purchaseDate: monthsAgo(60), lastServiceDate: monthsAgo(11, 12), carePlan: null },
    ],
    issues: [],
    quotes: {},
    bookings: [],
    orders: [],
  };
}

let db = null;

function load() {
  if (db) return db;
  try {
    db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    db = { households: {} };
  }
  return db;
}

function save() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

export function getHousehold(id) {
  const data = load();
  if (!data.households[id]) {
    data.households[id] = seedHousehold(id);
    save();
  }
  return data.households[id];
}

// Runs `fn` against the household and persists whatever it changed.
export function updateHousehold(id, fn) {
  const household = getHousehold(id);
  const result = fn(household);
  save();
  return result;
}

export function resetHousehold(id) {
  const data = load();
  data.households[id] = seedHousehold(id);
  save();
  return data.households[id];
}

export function newId(prefix) {
  return `${prefix}-${crypto.randomBytes(3).toString('hex')}`;
}
