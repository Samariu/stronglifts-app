import { openDB } from 'idb';

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
  barWeight: 20,
  weights: {
    squat: 20,
    benchPress: 20,
    barbellRow: 20,
    overheadPress: 20,
    deadlift: 20,
  },
  restTimers: {
    upper: 90,
    lower: 180,
  },
  setupComplete: false,
  backendUrl: '',
};
