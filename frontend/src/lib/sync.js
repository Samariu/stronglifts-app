// Backend sync — queues changes and syncs when backend is reachable

let syncQueue = JSON.parse(localStorage.getItem('syncQueue') || '[]');

const persist = () => localStorage.setItem('syncQueue', JSON.stringify(syncQueue));

export const queueSync = (type, data) => {
  syncQueue.push({ type, data, ts: Date.now() });
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
      await fetch(`${backendUrl}/api/${item.type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      syncQueue.push(item); // re-queue on failure
      persist();
    }
  }
  return true;
};

export const getSyncQueueLength = () => syncQueue.length;
