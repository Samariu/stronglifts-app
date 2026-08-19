// Persistence for the in-flight rest timer.
//
// iOS freezes (and eventually kills) a backgrounded PWA. Stashing the timer's
// end time means a relaunch can either pick a still-running rest back up, or
// tell you the rest you were waiting on finished while the app was away.

const STORAGE_KEY = 'restTimer';

// A rest that ended longer ago than this is history, not news — don't greet
// the user with an alert about yesterday's set.
export const DEFAULT_MAX_STALE_MS = 30 * 60 * 1000;

export const saveRestTimer = ({ endsAt, seconds }) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ endsAt, seconds }));
  } catch { /* private mode or quota — the timer just won't survive a relaunch */ }
};

export const loadRestTimer = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed.endsAt !== 'number' || typeof parsed.seconds !== 'number') {
      return null; // absent or corrupt — treat as no timer rather than crash
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearRestTimer = () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* nothing to do */ }
};

/**
 * Pure: decide what a stored timer means right now.
 * → { kind: 'none' | 'running' | 'elapsed', remaining }  (remaining in seconds)
 */
export const resumeState = (stored, now = Date.now(), maxStaleMs = DEFAULT_MAX_STALE_MS) => {
  if (!stored) return { kind: 'none', remaining: 0 };

  const { endsAt, seconds } = stored;
  const leftMs = endsAt - now;

  // More time left than the timer was ever set for means the clock moved (or
  // the entry is junk) — don't resurrect it.
  if (leftMs > seconds * 1000) return { kind: 'none', remaining: 0 };

  if (leftMs > 0) return { kind: 'running', remaining: Math.ceil(leftMs / 1000) };

  if (-leftMs <= maxStaleMs) return { kind: 'elapsed', remaining: 0 };

  return { kind: 'none', remaining: 0 };
};
