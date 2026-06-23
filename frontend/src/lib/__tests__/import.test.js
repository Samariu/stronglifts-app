import { describe, it, expect } from 'vitest';
import { importSessionsCSV } from '../import.js';

const HEADER = 'date,workout_type,exercise,weight_kg,sets_completed,sets_total,fully_completed,program';

describe('importSessionsCSV', () => {
  it('parses the program column and reconstructs sets', () => {
    const csv = [
      HEADER,
      '2026-01-01,A,Squat,100,5,5,yes,5x5-intermediate',
    ].join('\n');
    const { toImport, errors } = importSessionsCSV(csv);
    expect(errors).toEqual([]);
    expect(toImport).toHaveLength(1);
    expect(toImport[0].program).toBe('5x5-intermediate');
    expect(toImport[0].exercises.squat.weight).toBe(100);
    expect(toImport[0].exercises.squat.sets.filter((s) => s.completed)).toHaveLength(5);
  });

  it('imports accessory rows with the accessory flag', () => {
    const csv = [
      HEADER,
      '2026-01-02,B,Chin-up,0,3,3,yes,5x5',
    ].join('\n');
    const { toImport } = importSessionsCSV(csv);
    expect(toImport[0].exercises.chinUp.accessory).toBe(true);
    expect(toImport[0].exercises.chinUp.sets).toHaveLength(3);
  });

  it('defaults program to 5x5 when the column is absent (old CSV)', () => {
    const csv = [
      'date,workout_type,exercise,weight_kg,sets_completed,sets_total,fully_completed',
      '2026-01-03,A,Bench Press,40,5,5,yes',
    ].join('\n');
    const { toImport, errors } = importSessionsCSV(csv);
    expect(errors).toEqual([]);
    expect(toImport[0].program).toBe('5x5');
    expect(toImport[0].exercises.benchPress.weight).toBe(40);
  });
});
