// Backend sync — queues changes and syncs when backend is reachable.
// Offline-first: writes are queued in localStorage and flushed by trySync().

const STORAGE_KEY = 'syncQueue';
const MAX_QUEUE = 500; // hard cap so a backend-less queue can't overflow localStorage

const loadQueue = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // corrupt value — start clean rather than crash on import
  }
};

let syncQueue = loadQueue();

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(syncQueue));
  } catch {
    // localStorage full or unavailable — drop the oldest half and retry once
    syncQueue = syncQueue.slice(Math.floor(syncQueue.length / 2));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(syncQueue)); } catch { /* give up */ }
  }
};

// Identity for de-duplication: one pending entry per settings blob / per session.
const keyOf = (type, data) => (type === 'workouts' ? `workouts:${data?.id}` : type);

export const queueSync = (type, data) => {
  const key = keyOf(type, data);
  // Replace any pending entry for the same target — only the latest state matters.
  syncQueue = syncQueue.filter((item) => keyOf(item.type, item.data) !== key);
  syncQueue.push({ type, data, ts: Date.now() });
  if (syncQueue.length > MAX_QUEUE) syncQueue = syncQueue.slice(-MAX_QUEUE);
  persist();
};

export const trySync = async (backendUrl) => {
  if (!backendUrl || syncQueue.length === 0) return false;
  try {
    const res = await fetch(`${backendUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
  } catch {
    return false;
  }

  const queue = [...syncQueue];
  syncQueue = [];
  persist();

  for (const item of queue) {
    try {
      const res = await fetch(`${backendUrl}/api/${item.type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`sync failed: ${res.status}`);
    } catch {
      syncQueue.push(item); // re-queue on network error or non-2xx response
      persist();
    }
  }
  return true;
};

export const getSyncQueueLength = () => syncQueue.length;
