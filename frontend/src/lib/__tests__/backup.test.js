import { describe, it, expect } from 'vitest';
import { serializeBackup, parseBackup, BACKUP_FORMAT } from '../backup.js';
import { DEFAULT_SETTINGS } from '../db.js';

const session = {
  id: 'session-2026-01-01',
  date: '2026-01-01',
  sessionIndex: 0,
  workoutType: 'A',
  program: '5x5',
  exercises: {
    squat: { weight: 100, sets: [{ completed: true, ts: 1 }] },
    chinUp: { weight: 0, accessory: true, sets: [{ completed: true, ts: 2 }] },
  },
  completed: true,
  updatedAt: 123,
};

describe('backup round-trip', () => {
  it('serializes and restores settings and sessions losslessly', () => {
    const text = serializeBackup([session], DEFAULT_SETTINGS);
    const { settings, sessions, errors } = parseBackup(text);
    expect(errors).toEqual([]);
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(sessions).toEqual([session]);
    // accessory flag and program tag survive (the whole point over CSV)
    expect(sessions[0].exercises.chinUp.accessory).toBe(true);
    expect(sessions[0].program).toBe('5x5');
  });

  it('includes the format marker', () => {
    const parsed = JSON.parse(serializeBackup([], DEFAULT_SETTINGS));
    expect(parsed.format).toBe(BACKUP_FORMAT);
    expect(parsed.version).toBe(1);
  });
});

describe('parseBackup validation', () => {
  it('rejects non-JSON input', () => {
    const { settings, sessions, errors } = parseBackup('not json at all');
    expect(settings).toBe(null);
    expect(sessions).toEqual([]);
    expect(errors[0]).toMatch(/JSON/);
  });

  it('rejects JSON that is not a StrongLifts backup', () => {
    const { errors } = parseBackup(JSON.stringify({ hello: 'world' }));
    expect(errors[0]).toMatch(/backup/i);
  });

  it('skips invalid session entries but keeps valid ones', () => {
    const text = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      settings: DEFAULT_SETTINGS,
      sessions: [session, { id: 42, date: 'nope' }, null],
    });
    const { sessions, errors } = parseBackup(text);
    expect(sessions).toEqual([session]);
    expect(errors).toHaveLength(2);
  });
});
