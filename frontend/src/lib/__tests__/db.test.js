import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, migrateSettings } from '../db.js';

describe('migrateSettings', () => {
  it('leaves an already-current settings object unchanged (idempotent)', () => {
    const first = migrateSettings(DEFAULT_SETTINGS);
    expect(first.changed).toBe(false);

    // Running the migration again must also report no change.
    const second = migrateSettings(first.settings);
    expect(second.changed).toBe(false);
    expect(second.settings).toEqual(first.settings);
  });

  it('converts the legacy { upper, lower } rest timers to per-exercise keys', () => {
    const { settings, changed } = migrateSettings({
      restTimers: { upper: 60, lower: 120 },
    });
    expect(changed).toBe(true);
    expect(settings.restTimers.squat).toBe(120); // lower
    expect(settings.restTimers.deadlift).toBe(120); // lower
    expect(settings.restTimers.benchPress).toBe(60); // upper
    expect(settings.restTimers.barbellRow).toBe(60); // upper
    expect(settings.restTimers.overheadPress).toBe(60); // upper
  });

  it('clamps starting weights below an exercise minimum', () => {
    const { settings, changed } = migrateSettings({
      // keep the modern rest-timer shape so only the weight clamp triggers
      restTimers: DEFAULT_SETTINGS.restTimers,
      weights: {
        squat: 10,
        benchPress: 5,
        barbellRow: 10,
        overheadPress: 5,
        deadlift: 10,
      },
    });
    expect(changed).toBe(true);
    expect(settings.weights.squat).toBe(20); // bar minimum
    expect(settings.weights.benchPress).toBe(20);
    expect(settings.weights.overheadPress).toBe(20);
    expect(settings.weights.barbellRow).toBe(30); // bar + 10
    expect(settings.weights.deadlift).toBe(30); // bar + 10
  });

  it('fills in defaults for fields missing from a partial settings object', () => {
    const { settings } = migrateSettings({ barWeight: 20 });
    expect(settings.availablePlates).toEqual(DEFAULT_SETTINGS.availablePlates);
    expect(settings.increments).toEqual(DEFAULT_SETTINGS.increments);
    expect(settings.rom).toEqual(DEFAULT_SETTINGS.rom);
  });
});
