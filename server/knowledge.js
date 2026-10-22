// Appliance care knowledge base: troubleshooting guides, service pricing,
// warranty terms and maintenance intervals for common Indian household appliances.

export const APPLIANCE_TYPES = ['ac', 'refrigerator', 'washing_machine', 'water_purifier', 'geyser', 'microwave'];

export const LABELS = {
  ac: 'Air conditioner',
  refrigerator: 'Refrigerator',
  washing_machine: 'Washing machine',
  water_purifier: 'Water purifier (RO)',
  geyser: 'Water heater (geyser)',
  microwave: 'Microwave oven',
};

// Short spoken names, e.g. "Master bedroom AC".
export const SHORT = {
  ac: 'AC',
  refrigerator: 'fridge',
  washing_machine: 'washing machine',
  water_purifier: 'RO purifier',
  geyser: 'geyser',
  microwave: 'microwave',
};

// Standard manufacturer warranty, in months. `extended` covers a key part for longer.
export const WARRANTY = {
  ac: { months: 12, extended: { part: 'compressor', months: 60 } },
  refrigerator: { months: 12, extended: { part: 'compressor', months: 120 } },
  washing_machine: { months: 24, extended: { part: 'motor', months: 120 } },
  water_purifier: { months: 12 },
  geyser: { months: 24, extended: { part: 'inner tank', months: 60 } },
  microwave: { months: 12, extended: { part: 'magnetron', months: 36 } },
};

// How often routine servicing is recommended, in months, and an optional
// seasonal hint (month numbers, 1 = January).
export const MAINTENANCE = {
  ac: { everyMonths: 6, task: 'Wet service: clean filters, coils and drain line', season: [3, 4], seasonNote: 'Service before summer (March-April) to avoid the peak rush.' },
  refrigerator: { everyMonths: 12, task: 'Clean condenser coils and check door gasket' },
  washing_machine: { everyMonths: 6, task: 'Drum descaling and filter cleaning' },
  water_purifier: { everyMonths: 6, task: 'Replace sediment and carbon filters, check TDS' },
  geyser: { everyMonths: 12, task: 'Descale heating element and check anode rod', season: [10, 11], seasonNote: 'Check before winter (October-November).' },
  microwave: { everyMonths: 24, task: 'Inspect door seal and magnetron output' },
};

// Visit charge plus typical repair ranges in INR.
export const PRICING = {
  ac: { visit: 399, service: 599, repairRange: [800, 4500], gasRefill: 2500 },
  refrigerator: { visit: 349, service: 499, repairRange: [700, 5000], gasRefill: 2200 },
  washing_machine: { visit: 349, service: 549, repairRange: [600, 3500] },
  water_purifier: { visit: 249, service: 899, repairRange: [400, 2500] },
  geyser: { visit: 299, service: 499, repairRange: [500, 3000] },
  microwave: { visit: 299, service: 399, repairRange: [600, 3500] },
};

export const CARE_PLANS = {
  basic: {
    name: 'HomeKeeper Basic',
    pricePerAppliance: 999,
    includes: ['2 preventive services per year', 'Free visit charges', '10% off spare parts'],
  },
  complete: {
    name: 'HomeKeeper Complete',
    pricePerAppliance: 2499,
    includes: ['2 preventive services per year', 'Unlimited breakdown visits', 'Labour and gas refill covered', '25% off spare parts', 'Priority same-day slots'],
  },
};

// Troubleshooting guides. Each guide matches on symptom keywords and lists DIY
// checks in order, likely causes, and whether a technician is usually needed.
export const GUIDES = [
  {
    type: 'ac', id: 'ac-not-cooling', title: 'AC not cooling',
    keywords: ['not cooling', 'no cooling', 'warm air', 'less cooling', 'weak cooling', 'hot air', 'cooling'],
    diy: [
      'Check the remote is in COOL mode (snowflake icon), not FAN or DRY, and set to 24°C.',
      'Open the front panel and clean the mesh filters with plain water. Dry them fully before refitting.',
      'Make sure doors and windows are closed and the outdoor unit is not blocked or in direct afternoon sun.',
      'Check the outdoor unit fan is spinning. If it is silent, switch off the stabiliser for 3 minutes and restart.',
    ],
    causes: ['Clogged filters', 'Low refrigerant gas', 'Outdoor unit fan or capacitor failure', 'Dirty condenser coil'],
    technicianLikely: false,
    safety: null,
  },
  {
    type: 'ac', id: 'ac-water-leak', title: 'AC leaking water indoors',
    keywords: ['leak', 'leaking', 'dripping', 'water dropping', 'water coming'],
    diy: [
      'Switch the AC off and place a towel or bucket below the indoor unit.',
      'Check the drain pipe outside is not bent, blocked or pointing upward.',
      'Clean the filters: heavy dust causes ice build-up that melts and overflows.',
    ],
    causes: ['Blocked drain line', 'Indoor unit tilted after installation', 'Frozen evaporator from dirty filters'],
    technicianLikely: true,
    safety: null,
  },
  {
    type: 'ac', id: 'ac-not-starting', title: 'AC not turning on',
    keywords: ['not starting', 'not turning on', 'dead', 'no power', 'won\'t start', 'not working'],
    diy: [
      'Replace the remote batteries and point it directly at the indoor unit.',
      'Check the MCB in the distribution board has not tripped.',
      'Check the stabiliser display: wait for the delay timer (usually 3 minutes) to finish.',
    ],
    causes: ['Tripped MCB', 'Stabiliser fault', 'PCB failure after voltage fluctuation'],
    technicianLikely: true,
    safety: 'If you smell burning or see scorch marks near the socket, switch off the MCB and do not use the AC.',
  },
  {
    type: 'refrigerator', id: 'fridge-not-cooling', title: 'Refrigerator not cooling',
    keywords: ['not cooling', 'warm', 'no cooling', 'cooling'],
    diy: [
      'Check the temperature dial is not set to minimum or vacation mode.',
      'Leave 10 cm gap behind the fridge for air flow and check the back coils for dust.',
      'Check the door gasket closes tightly: a paper strip shut in the door should not slide out easily.',
      'Avoid overloading: blocked vents inside stop cold air from circulating.',
    ],
    causes: ['Blocked vents', 'Faulty door gasket', 'Thermostat failure', 'Low refrigerant gas'],
    technicianLikely: false,
    safety: null,
  },
  {
    type: 'refrigerator', id: 'fridge-noise', title: 'Refrigerator making loud noise',
    keywords: ['noise', 'sound', 'loud', 'humming', 'rattling', 'buzzing'],
    diy: [
      'Check the fridge stands level and is not touching the wall or cabinets.',
      'Remove items on top of the fridge that may vibrate.',
    ],
    causes: ['Uneven floor', 'Condenser fan obstruction', 'Compressor wear'],
    technicianLikely: true,
    safety: null,
  },
  {
    type: 'washing_machine', id: 'wm-not-draining', title: 'Washing machine not draining',
    keywords: ['not draining', 'water not going', 'water stuck', 'drain', 'water inside'],
    diy: [
      'Check the drain hose is not kinked and its end is lower than the drum.',
      'Clean the drain pump filter (small door at the bottom front). Keep a tray ready for water.',
      'Run a "Drain/Spin only" cycle.',
    ],
    causes: ['Clogged pump filter', 'Kinked hose', 'Drain pump failure'],
    technicianLikely: false,
    safety: null,
  },
  {
    type: 'washing_machine', id: 'wm-vibration', title: 'Washing machine shaking during spin',
    keywords: ['shaking', 'vibrating', 'vibration', 'moving', 'jumping', 'noise'],
    diy: [
      'Spread clothes evenly. A single heavy item like a blanket causes imbalance.',
      'Check the machine is level, and adjust the feet if it rocks.',
      'For a new machine, confirm the transit bolts at the back were removed.',
    ],
    causes: ['Unbalanced load', 'Uneven floor', 'Transit bolts not removed', 'Worn shock absorbers'],
    technicianLikely: false,
    safety: null,
  },
  {
    type: 'washing_machine', id: 'wm-not-starting', title: 'Washing machine not starting',
    keywords: ['not starting', 'not turning on', 'dead', 'won\'t start', 'door', 'error'],
    diy: [
      'Make sure the door or lid is fully closed until it clicks.',
      'Check the water tap is open: many machines refuse to start without water pressure.',
      'Note any error code on the display and tell me, so I can look it up.',
    ],
    causes: ['Door lock fault', 'No water inlet pressure', 'Control board error'],
    technicianLikely: true,
    safety: null,
  },
  {
    type: 'water_purifier', id: 'ro-taste', title: 'RO water tastes bad or low flow',
    keywords: ['taste', 'smell', 'low flow', 'slow', 'less water', 'salty', 'tds'],
    diy: [
      'Check when the filters were last changed. Sediment and carbon filters last about 6 months.',
      'Drain the storage tank fully once and let it refill.',
    ],
    causes: ['Filters due for replacement', 'RO membrane choked', 'Low inlet pressure'],
    technicianLikely: true,
    safety: null,
  },
  {
    type: 'geyser', id: 'geyser-no-hot-water', title: 'Geyser not heating water',
    keywords: ['not heating', 'cold water', 'no hot water', 'not hot', 'heating'],
    diy: [
      'Check the power indicator lamp is on and the thermostat knob is not at minimum.',
      'Check the MCB for the bathroom circuit.',
    ],
    causes: ['Heating element burnt', 'Thermostat failure', 'Scale build-up'],
    technicianLikely: true,
    safety: 'If you feel any electric tingling from the tap or the geyser body, switch off the power immediately and do not use it until it is inspected.',
  },
  {
    type: 'microwave', id: 'mw-not-heating', title: 'Microwave runs but does not heat',
    keywords: ['not heating', 'cold', 'no heat', 'heating'],
    diy: [
      'Test with a cup of water for 1 minute on full power.',
      'Make sure the door closes firmly. A loose latch can stop heating.',
    ],
    causes: ['Magnetron failure', 'High-voltage diode fault', 'Door switch fault'],
    technicianLikely: true,
    safety: 'Do not open the microwave casing: the capacitor holds a dangerous charge even when unplugged.',
  },
];

export function findGuide(type, symptom) {
  const s = symptom.toLowerCase();
  const candidates = GUIDES.filter(g => g.type === type);
  let best = null;
  let bestScore = 0;
  for (const g of candidates) {
    const score = g.keywords.reduce((n, k) => (s.includes(k) ? n + k.length : n), 0);
    if (score > bestScore) {
      best = g;
      bestScore = score;
    }
  }
  return best;
}
