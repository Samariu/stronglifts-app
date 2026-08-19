import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveRestTimer, loadRestTimer, clearRestTimer, resumeState, DEFAULT_MAX_STALE_MS,
} from '../restTimer';

describe('resumeState', () => {
  const now = 1_700_000_000_000;

  it('reports nothing when no timer was stored', () => {
    expect(resumeState(null, now)).toEqual({ kind: 'none', remaining: 0 });
  });

  it('resumes a timer that is still running, rounding up to whole seconds', () => {
    const stored = { endsAt: now + 61_500, seconds: 180 };
    expect(resumeState(stored, now)).toEqual({ kind: 'running', remaining: 62 });
  });

  it('reports a rest that finished while the app was away', () => {
    const stored = { endsAt: now - 5 * 60_000, seconds: 180 };
    expect(resumeState(stored, now)).toEqual({ kind: 'elapsed', remaining: 0 });
  });

  it('ignores a rest that ended longer ago than the stale window', () => {
    const stored = { endsAt: now - DEFAULT_MAX_STALE_MS - 1, seconds: 180 };
    expect(resumeState(stored, now)).toEqual({ kind: 'none', remaining: 0 });
  });

  it('ignores an end time further out than the timer could ever have been', () => {
    const stored = { endsAt: now + 10 * 60_000, seconds: 90 }; // clock jump or junk
    expect(resumeState(stored, now)).toEqual({ kind: 'none', remaining: 0 });
  });
});

describe('storage', () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    });
  });

  it('round-trips a saved timer', () => {
    saveRestTimer({ endsAt: 1234, seconds: 90 });
    expect(loadRestTimer()).toEqual({ endsAt: 1234, seconds: 90 });
  });

  it('clears the stored timer', () => {
    saveRestTimer({ endsAt: 1234, seconds: 90 });
    clearRestTimer();
    expect(loadRestTimer()).toBeNull();
  });

  it('treats a corrupt or half-written value as no timer', () => {
    localStorage.setItem('restTimer', '{not json');
    expect(loadRestTimer()).toBeNull();
    localStorage.setItem('restTimer', JSON.stringify({ endsAt: 'soon' }));
    expect(loadRestTimer()).toBeNull();
  });
});
