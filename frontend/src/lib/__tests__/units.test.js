import { describe, it, expect } from 'vitest';
import {
  KG_PER_LB,
  lbToKg,
  kgToLb,
  LB_PLATE_SIZES,
  UNIT_PROFILES,
  toDisplay,
  fromDisplay,
  formatWeight,
  formatNum,
  unitSwitchDefaults,
  getUnit,
} from '../units.js';
import {
  deload,
  getMinWeight,
  getPlatesPerSide,
  formatPlates,
  getWarmupSets,
  EXERCISES,
} from '../program.js';

describe('conversions', () => {
  it('round-trips kg ↔ lb', () => {
    expect(kgToLb(lbToKg(225))).toBeCloseTo(225, 10);
    expect(lbToKg(45)).toBeCloseTo(20.4117, 3);
    expect(KG_PER_LB).toBeCloseTo(0.45359237, 10);
  });

  it('toDisplay / fromDisplay are identity for kg', () => {
    expect(toDisplay(100, 'kg')).toBe(100);
    expect(fromDisplay(100, 'kg')).toBe(100);
    expect(toDisplay(lbToKg(135), 'lb')).toBeCloseTo(135, 10);
  });

  it('getUnit defaults to kg', () => {
    expect(getUnit(undefined)).toBe('kg');
    expect(getUnit({})).toBe('kg');
    expect(getUnit({ unit: 'lb' })).toBe('lb');
  });
});

describe('formatWeight', () => {
  it('formats kg values as-is', () => {
    expect(formatWeight(100, 'kg')).toBe('100kg');
    expect(formatWeight(102.5, 'kg')).toBe('102.5kg');
  });
  it('formats lb-native values as clean lb numbers', () => {
    expect(formatWeight(lbToKg(225), 'lb')).toBe('225lb');
    expect(formatWeight(lbToKg(47.5), 'lb')).toBe('47.5lb');
  });
  it('rounds kg-legacy values to one decimal in lb', () => {
    expect(formatNum(toDisplay(102.5, 'lb'))).toBe('226'); // 225.97 → 226
  });
});

describe('lb unit profile', () => {
  const lb = UNIT_PROFILES.lb;

  it('loads a classic 225 lb bar with two 45s per side', () => {
    const plates = getPlatesPerSide(lbToKg(225), lbToKg(45), lb.plates);
    expect(plates).toHaveLength(2);
    for (const p of plates) expect(kgToLb(p)).toBeCloseTo(45, 6);
    expect(formatPlates(lbToKg(225), lbToKg(45), lb.plates, 'lb')).toBe('2×45lb');
  });

  it('deloads on the 5 lb grid', () => {
    // 225 lb → 202.5 lb → snaps to a whole 5 lb step
    const next = deload(lbToKg(225), lb.roundStep);
    const inLb = kgToLb(next);
    expect(inLb % 5).toBeCloseTo(0, 6);
    expect(Math.abs(inLb - 202.5)).toBeLessThanOrEqual(2.5);
  });

  it('row/deadlift minimum is bar + a 10 lb plate per side', () => {
    expect(kgToLb(getMinWeight('deadlift', lbToKg(45), lb.minPlatePair))).toBeCloseTo(65, 6);
    expect(kgToLb(getMinWeight('squat', lbToKg(45), lb.minPlatePair))).toBeCloseTo(45, 6);
  });

  it('warmup ramps land on whole 10 lb+ plate pairs', () => {
    const bar = lbToKg(45);
    const sets = getWarmupSets(lbToKg(225), bar, lb.plates, true, lb.minWarmupPlate);
    expect(sets).toHaveLength(5);
    for (const s of sets.slice(2)) {
      // (weight − bar) must be a multiple of 20 lb (2 × 10 lb plates)
      expect((kgToLb(s.weight - bar) % 20 + 20) % 20).toBeCloseTo(0, 5);
      expect(s.weight).toBeLessThan(lbToKg(225));
    }
  });
});

describe('unitSwitchDefaults', () => {
  it('returns the standard lb hardware in kg storage values', () => {
    const d = unitSwitchDefaults('lb');
    expect(d.unit).toBe('lb');
    expect(d.availablePlates).toEqual(LB_PLATE_SIZES);
    expect(kgToLb(d.barWeight)).toBeCloseTo(45, 6);
    expect(kgToLb(d.increments.squat)).toBeCloseTo(5, 6);
    expect(kgToLb(d.increments.deadlift)).toBeCloseTo(10, 6);
    // every catalog exercise gets an increment
    expect(Object.keys(d.increments).sort()).toEqual(Object.keys(EXERCISES).sort());
  });

  it('returns the familiar kg defaults for kg', () => {
    const d = unitSwitchDefaults('kg');
    expect(d.barWeight).toBe(20);
    expect(d.increments.squat).toBe(2.5);
    expect(d.increments.deadlift).toBe(5);
  });
});
