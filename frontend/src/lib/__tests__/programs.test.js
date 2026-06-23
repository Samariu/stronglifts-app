import { describe, it, expect } from 'vitest';
import {
  PROGRAMS,
  ACCESSORIES,
  getProgram,
  getActiveProgram,
  getProgramExerciseKeys,
  isAccessory,
  isBarbell,
} from '../programs.js';
import { EXERCISES, getSetsReps, exerciseSucceeded, computeNextWeight } from '../program.js';

const makeSession = (date, workoutType, exercises) => ({ date, workoutType, exercises });
const sets = (completed, total) =>
  Array.from({ length: total }, (_, i) => ({ completed: i < completed, ts: 0 }));

// =========================================================================
// Registry integrity
// =========================================================================
describe('program registry', () => {
  it('has a workout for every label in each program cycle', () => {
    for (const program of Object.values(PROGRAMS)) {
      for (const label of program.cycle) {
        expect(program.workouts[label]).toBeDefined();
        expect(program.workouts[label].exercises.length).toBeGreaterThan(0);
      }
    }
  });

  it('only references known exercise or accessory keys', () => {
    for (const program of Object.values(PROGRAMS)) {
      for (const label of program.cycle) {
        for (const ex of program.workouts[label].exercises) {
          expect(ex.key in EXERCISES || ex.key in ACCESSORIES).toBe(true);
        }
      }
    }
  });
});

// =========================================================================
// getProgram / getActiveProgram
// =========================================================================
describe('getProgram / getActiveProgram', () => {
  it('resolves a known id', () => {
    expect(getProgram('5x5-intermediate').id).toBe('5x5-intermediate');
  });
  it('falls back to 5x5 for an unknown or missing id', () => {
    expect(getProgram('does-not-exist').id).toBe('5x5');
    expect(getActiveProgram(undefined).id).toBe('5x5');
    expect(getActiveProgram({}).id).toBe('5x5');
  });
  it('reads the active program from settings', () => {
    expect(getActiveProgram({ program: '5x5-intermediate' }).id).toBe('5x5-intermediate');
  });
});

// =========================================================================
// getProgramExerciseKeys
// =========================================================================
describe('getProgramExerciseKeys', () => {
  it('returns unique keys across all workouts in order', () => {
    expect(getProgramExerciseKeys(getProgram('5x5'))).toEqual([
      'squat', 'benchPress', 'barbellRow', 'overheadPress', 'deadlift',
    ]);
    expect(getProgramExerciseKeys(getProgram('5x5-intermediate'))).toEqual([
      'squat', 'benchPress', 'barbellRow', 'deadlift', 'inclineBench', 'closeGripBench',
    ]);
  });
});

// =========================================================================
// Program-aware getSetsReps
// =========================================================================
describe('program-aware getSetsReps', () => {
  const intermediate = getProgram('5x5-intermediate');
  const base = getProgram('5x5');

  it('applies the Intermediate schemes', () => {
    expect(getSetsReps('barbellRow', intermediate)).toEqual({ sets: 5, reps: 8 });
    expect(getSetsReps('deadlift', intermediate)).toEqual({ sets: 5, reps: 5 });
    expect(getSetsReps('squat', intermediate)).toEqual({ sets: 5, reps: 5 });
  });

  it('keeps the classic 5x5 schemes (regression guard)', () => {
    expect(getSetsReps('deadlift', base)).toEqual({ sets: 1, reps: 5 });
    expect(getSetsReps('barbellRow', base)).toEqual({ sets: 5, reps: 5 });
  });
});

// =========================================================================
// isAccessory / isBarbell
// =========================================================================
describe('isAccessory / isBarbell', () => {
  it('partitions the catalog', () => {
    expect(isAccessory('chinUp')).toBe(true);
    expect(isAccessory('squat')).toBe(false);
    expect(isBarbell('squat')).toBe(true);
    expect(isBarbell('inclineBench')).toBe(true);
    expect(isBarbell('chinUp')).toBe(false);
  });
});

// =========================================================================
// Program-aware success / progression
// =========================================================================
describe('program-aware success detection', () => {
  it('requires 5 deadlift sets under Intermediate but 1 under base 5x5', () => {
    const oneSet = makeSession('2026-01-01', 'B', { deadlift: { weight: 100, sets: sets(1, 1) } });
    expect(exerciseSucceeded(oneSet, 'deadlift', getProgram('5x5'))).toBe(true);
    expect(exerciseSucceeded(oneSet, 'deadlift', getProgram('5x5-intermediate'))).toBe(false);

    const fiveSets = makeSession('2026-01-01', 'B', { deadlift: { weight: 100, sets: sets(5, 5) } });
    expect(exerciseSucceeded(fiveSets, 'deadlift', getProgram('5x5-intermediate'))).toBe(true);
  });
});

describe('accessories do not pollute barbell progression', () => {
  it('ignores an accessory entry when progressing a barbell lift', () => {
    const session = makeSession('2026-01-01', 'A', {
      squat: { weight: 100, sets: sets(5, 5) },
      chinUp: { weight: 0, accessory: true, sets: sets(3, 3) },
    });
    // squat succeeded → +2.5; the chin-up entry is irrelevant
    expect(computeNextWeight([session], 'squat', 20, undefined, getProgram('5x5'))).toBe(102.5);
  });
});
