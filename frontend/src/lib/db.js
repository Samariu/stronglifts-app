import { openDB } from 'idb';
import { EXERCISES, getMinWeight, KG_PER_LB } from './program';

const DB_NAME = 'stronglifts';
const DB_VERSION = 1;

let dbPromise;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
        if (!db.objectStoreNames.contains('sessions')) {
          const store = db.createObjectStore('sessions', { keyPath: 'id' });
          store.createIndex('date', 'date');
        }
      },
    });
  }
  return dbPromise;
};

// Settings
export const getSettings = async () => {
  const db = await getDB();
  return db.get('settings', 'config');
};

export const saveSettings = async (settings) => {
  const db = await getDB();
  return db.put('settings', { ...settings, updatedAt: Date.now() }, 'config');
};

// Sessions
export const getAllSessions = async () => {
  const db = await getDB();
  return db.getAll('sessions');
};

export const getSession = async (id) => {
  const db = await getDB();
  return db.get('sessions', id);
};

export const saveSession = async (session) => {
  const db = await getDB();
  return db.put('sessions', { ...session, updatedAt: Date.now() });
};

export const deleteSession = async (id) => {
  const db = await getDB();
  return db.delete('sessions', id);
};

// Create a new session ID from date
export const makeSessionId = (date) => `session-${date}`;

// Default settings
export const DEFAULT_SETTINGS = {
  program: '5x5',
  unit: 'kg',                  // display unit — all stored weights stay in kg
  barWeight: 20,
  availablePlates: [25, 20, 15, 10, 5, 2.5, 1.25],
  weights: {
    squat: 20,
    benchPress: 20,
    barbellRow: 30,
    overheadPress: 20,
    deadlift: 30,
    inclineBench: 20,
    closeGripBench: 20,
  },
  restTimers: {
    squat: 180,
    benchPress: 90,
    barbellRow: 90,
    overheadPress: 90,
    deadlift: 180,
    inclineBench: 90,
    closeGripBench: 90,
  },
  increments: {
    squat: 2.5,
    benchPress: 2.5,
    barbellRow: 2.5,
    overheadPress: 2.5,
    deadlift: 5.0,
    inclineBench: 2.5,
    closeGripBench: 2.5,
  },
  rom: {
    squat: 0.6,
    benchPress: 0.5,
    barbellRow: 0.5,
    overheadPress: 0.6,
    deadlift: 0.65,
    inclineBench: 0.45,
    closeGripBench: 0.45,
  },
  // Per-workout-label assistance work the user has enabled, e.g. { A: [{ key, sets, weight }] }
  accessories: {},
  // Training days (0=Sun … 6=Sat) for the History projection; null follows the program default.
  scheduleDows: null,
  nextWeightOverrides: {},
  csvImportConflict: 'ask',
  setupComplete: false,
  backendUrl: '',
};

// Upgrade a stored settings object to the current shape.
// Returns { settings, changed } — `changed` is true if anything was migrated,
// so the caller can persist the upgraded copy once.
export const migrateSettings = (stored) => {
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  let changed = false;

  // New top-level fields (program selector, accessories, units, schedule)
  // absent on legacy data.
  if (!('program' in stored)) changed = true;
  if (!('accessories' in stored)) changed = true;
  if (!('unit' in stored)) changed = true;
  if (!('scheduleDows' in stored)) changed = true;

  // restTimers: legacy { upper, lower } → per-exercise keys
  const rt = stored.restTimers ?? {};
  if (!('squat' in rt)) {
    settings.restTimers = Object.fromEntries(
      Object.entries(EXERCISES).map(([key, ex]) => [
        key,
        rt[ex.isLower ? 'lower' : 'upper'] ?? DEFAULT_SETTINGS.restTimers[key],
      ]),
    );
    changed = true;
  }

  // Backfill any per-exercise maps that predate newly added exercises
  // (e.g. the Intermediate bench variations) without disturbing user values.
  for (const mapKey of ['weights', 'restTimers', 'increments', 'rom']) {
    const current  = settings[mapKey] ?? {};
    const defaults = DEFAULT_SETTINGS[mapKey];
    const filled   = { ...current };
    let mapChanged = false;
    for (const key of Object.keys(defaults)) {
      if (!(key in filled)) {
        filled[key] = defaults[key];
        mapChanged = true;
      }
    }
    if (mapChanged) {
      settings[mapKey] = filled;
      changed = true;
    }
  }

  // Clamp starting weights below an exercise's physical minimum — Barbell Row
  // and Deadlift need a plate per side, so at least bar + 10 kg (or the lb
  // equivalent, bar + 2 × 10 lb, for lb-unit users).
  const barWeight = settings.barWeight ?? DEFAULT_SETTINGS.barWeight;
  const platePair = settings.unit === 'lb' ? 20 * KG_PER_LB : 10;
  const weights = { ...settings.weights };
  let weightsChanged = false;
  for (const key of Object.keys(EXERCISES)) {
    const min = getMinWeight(key, barWeight, platePair);
    if (weights[key] != null && weights[key] < min) {
      weights[key] = min;
      weightsChanged = true;
    }
  }
  if (weightsChanged) {
    settings.weights = weights;
    changed = true;
  }

  return { settings, changed };
};
