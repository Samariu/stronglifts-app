// kg/lb unit system.
//
// ALL weights are STORED in kg — the database, sync payloads and CSV never
// change. The unit only affects the display/input edges plus the "physical
// hardware" defaults (plate sizes, bar weight, increments, rounding steps),
// which are themselves stored as exact kg values so plate math keeps running
// in one unit.
import { ALL_PLATE_SIZES, EXERCISES, KG_PER_LB } from './program';

export { KG_PER_LB };
export const lbToKg = (lb) => lb * KG_PER_LB;
export const kgToLb = (kg) => kg / KG_PER_LB;

// Standard lb plate set, stored as exact kg values.
export const LB_PLATE_SIZES = [45, 35, 25, 10, 5, 2.5].map(lbToKg);

export const UNIT_PROFILES = {
  kg: {
    unit: 'kg',
    plates: ALL_PLATE_SIZES,
    roundStep: 2.5,                 // deload rounding — smallest per-side pair (2 × 1.25 kg)
    minWarmupPlate: 5,              // warmups load whole 5 kg+ plates only
    minPlatePair: 10,               // Row/Deadlift floor: one plate per side (2 × 5 kg)
    incrementOptions: { default: [1.25, 2.5], deadlift: [2.5, 5] },
    barOptions: [15, 20],
    defaultBar: 20,
    barStep: 2.5,
  },
  lb: {
    unit: 'lb',
    plates: LB_PLATE_SIZES,
    roundStep: lbToKg(5),           // 2 × 2.5 lb
    minWarmupPlate: lbToKg(10) - 1e-9, // 10 lb plates count as warmup plates
    minPlatePair: lbToKg(20),       // 2 × 10 lb
    incrementOptions: { default: [lbToKg(2.5), lbToKg(5)], deadlift: [lbToKg(5), lbToKg(10)] },
    barOptions: [lbToKg(35), lbToKg(45)],
    defaultBar: lbToKg(45),
    barStep: lbToKg(2.5),
  },
};

export const getUnit = (settings) => (settings?.unit === 'lb' ? 'lb' : 'kg');
export const getUnitProfile = (settings) => UNIT_PROFILES[getUnit(settings)];

export const toDisplay = (kg, unit = 'kg') => (unit === 'lb' ? kgToLb(kg) : kg);
export const fromDisplay = (value, unit = 'kg') => (unit === 'lb' ? lbToKg(value) : value);

// Display number: rounded to one decimal, trailing .0 dropped by Number/String.
export const formatNum = (v) => String(Math.round(v * 10) / 10);

export const formatWeight = (kg, unit = 'kg') => `${formatNum(toDisplay(kg, unit))}${unit}`;

// Settings patch applied when switching unit systems: the standard plate set,
// bar weight and per-exercise increments for that system. Stored session
// history is untouched (it is unit-less kg data).
export const unitSwitchDefaults = (unit) => {
  const p = UNIT_PROFILES[unit];
  return {
    unit,
    availablePlates: p.plates,
    barWeight: p.defaultBar,
    increments: Object.fromEntries(
      Object.keys(EXERCISES).map((key) => [
        key,
        p.incrementOptions[key === 'deadlift' ? 'deadlift' : 'default'][1],
      ]),
    ),
  };
};
