import { describe, it, expect } from 'vitest';
import {
  EXERCISES,
  ALL_PLATE_SIZES,
  WORKOUT_A,
  WORKOUT_B,
  getSetsReps,
  getMinWeight,
  getRestSeconds,
  getWorkoutType,
  getWorkoutExercises,
  epley1RM,
  roundToNearest,
  deload,
  exerciseSucceeded,
  countConsecutiveFailures,
  computeNextWeight,
  getPlatesPerSide,
  formatPlates,
  getWarmupSets,
} from '../program.js';

// --- Test helpers ----------------------------------------------------------

// Build a session with one exercise and a given number of completed/total sets.
const makeSession = (date, workoutType, exerciseKey, weight, completedCount, totalCount) => ({
  date,
  workoutType,
  exercises: {
    [exerciseKey]: {
      weight,
      sets: Array.from({ length: totalCount }, (_, i) => ({
        completed: i < completedCount,
        ts: 0,
      })),
    },
  },
});

// =========================================================================
// roundToNearest / deload
// =========================================================================
describe('roundToNearest', () => {
  it('rounds to the nearest step', () => {
    expect(roundToNearest(92.25, 2.5)).toBe(92.5);
    expect(roundToNearest(91, 2.5)).toBe(90);
    expect(roundToNearest(100, 5)).toBe(100);
  });
});

describe('deload', () => {
  it('cuts 10% and snaps to the nearest 2.5 kg', () => {
    expect(deload(100)).toBe(90);
    expect(deload(102.5)).toBe(92.5); // 92.25 -> 92.5
    expect(deload(20)).toBe(17.5); // 18 -> 17.5
    expect(deload(60)).toBe(55); // 54 -> 55
  });
});

// =========================================================================
// epley1RM
// =========================================================================
describe('epley1RM', () => {
  it('applies the Epley formula w*(1 + reps/30)', () => {
    expect(epley1RM(100, 5)).toBeCloseTo(116.667, 2);
    expect(epley1RM(100, 1)).toBeCloseTo(103.333, 2);
    expect(epley1RM(0, 5)).toBe(0);
  });
});

// =========================================================================
// getMinWeight
// =========================================================================
describe('getMinWeight', () => {
  it('requires a plate per side for deadlift and row (bar + 10)', () => {
    expect(getMinWeight('deadlift', 20)).toBe(30);
    expect(getMinWeight('barbellRow', 20)).toBe(30);
  });
  it('allows the empty bar for press movements', () => {
    expect(getMinWeight('squat', 20)).toBe(20);
    expect(getMinWeight('benchPress', 20)).toBe(20);
    expect(getMinWeight('overheadPress', 20)).toBe(20);
  });
  it('respects a custom bar weight', () => {
    expect(getMinWeight('deadlift', 15)).toBe(25);
    expect(getMinWeight('squat', 15)).toBe(15);
  });
});

// =========================================================================
// getSetsReps
// =========================================================================
describe('getSetsReps', () => {
  it('is 1x5 for deadlift', () => {
    expect(getSetsReps('deadlift')).toEqual({ sets: 1, reps: 5 });
  });
  it('is 5x5 for every other lift', () => {
    for (const key of ['squat', 'benchPress', 'barbellRow', 'overheadPress']) {
      expect(getSetsReps(key)).toEqual({ sets: 5, reps: 5 });
    }
  });
});

// =========================================================================
// getRestSeconds
// =========================================================================
describe('getRestSeconds', () => {
  it('prefers a per-exercise value', () => {
    expect(getRestSeconds({ squat: 200 }, 'squat')).toBe(200);
  });
  it('falls back to the legacy upper/lower shape', () => {
    const legacy = { upper: 60, lower: 120 };
    expect(getRestSeconds(legacy, 'squat')).toBe(120); // squat is lower
    expect(getRestSeconds(legacy, 'deadlift')).toBe(120);
    expect(getRestSeconds(legacy, 'benchPress')).toBe(60); // bench is upper
    expect(getRestSeconds(legacy, 'overheadPress')).toBe(60); // ohp is upper
  });
  it('falls back to the exercise default when nothing is configured', () => {
    expect(getRestSeconds({}, 'squat')).toBe(EXERCISES.squat.restSeconds);
    expect(getRestSeconds({}, 'benchPress')).toBe(EXERCISES.benchPress.restSeconds);
  });
});

// =========================================================================
// getWorkoutType / getWorkoutExercises
// =========================================================================
describe('getWorkoutType', () => {
  it('alternates A/B by session-index parity', () => {
    expect(getWorkoutType(0)).toBe('A');
    expect(getWorkoutType(1)).toBe('B');
    expect(getWorkoutType(2)).toBe('A');
    expect(getWorkoutType(3)).toBe('B');
  });
});

describe('getWorkoutExercises', () => {
  it('returns the exercises for each workout', () => {
    expect(getWorkoutExercises('A')).toEqual(WORKOUT_A);
    expect(getWorkoutExercises('B')).toEqual(WORKOUT_B);
    expect(getWorkoutExercises('A')).toEqual(['squat', 'benchPress', 'barbellRow']);
    expect(getWorkoutExercises('B')).toEqual(['squat', 'overheadPress', 'deadlift']);
  });
});

// =========================================================================
// getPlatesPerSide
// =========================================================================
describe('getPlatesPerSide', () => {
  it('greedily picks the largest plates first', () => {
    // 100 kg, 20 kg bar -> 40 kg per side -> 25 + 15
    expect(getPlatesPerSide(100, 20)).toEqual([25, 15]);
    // 60 kg -> 20 kg per side -> single 20
    expect(getPlatesPerSide(60, 20)).toEqual([20]);
  });
  it('returns no plates for bar-only or sub-bar weights', () => {
    expect(getPlatesPerSide(20, 20)).toEqual([]);
    expect(getPlatesPerSide(10, 20)).toEqual([]);
  });
  it('respects a restricted plate set', () => {
    // no 25s or 15s available -> 40 kg per side becomes 20 + 20
    expect(getPlatesPerSide(100, 20, [20, 10, 5, 2.5, 1.25])).toEqual([20, 20]);
  });
  it('handles small-plate fractions without floating-point residue', () => {
    expect(getPlatesPerSide(22.5, 20)).toEqual([1.25]);
    expect(getPlatesPerSide(25, 20)).toEqual([2.5]);
    // 41.25 kg per side -> 25 + 15 + 1.25, summing exactly
    const plates = getPlatesPerSide(102.5, 20);
    expect(plates).toEqual([25, 15, 1.25]);
    expect(plates.reduce((a, b) => a + b, 0)).toBeCloseTo(41.25, 5);
  });
});

// =========================================================================
// formatPlates
// =========================================================================
describe('formatPlates', () => {
  it('groups identical plates and labels per side', () => {
    // JS iterates integer-like object keys in ascending order, so 15 prints before 25.
    expect(formatPlates(100, 20)).toBe('1×15kg + 1×25kg');
    expect(formatPlates(100, 20, [20, 10, 5, 2.5, 1.25])).toBe('2×20kg');
  });
  it('says "Bar only" when nothing is loaded', () => {
    expect(formatPlates(20, 20)).toBe('Bar only');
  });
});

// =========================================================================
// getWarmupSets
// =========================================================================
describe('getWarmupSets', () => {
  it('returns nothing when the working weight is at or below the bar', () => {
    expect(getWarmupSets(20, 20)).toEqual([]);
    expect(getWarmupSets(15, 20)).toEqual([]);
  });

  it('always produces exactly 5 sets when warming up is needed', () => {
    expect(getWarmupSets(100, 20, ALL_PLATE_SIZES, true)).toHaveLength(5);
    expect(getWarmupSets(100, 20, ALL_PLATE_SIZES, false)).toHaveLength(5);
    expect(getWarmupSets(60, 20, ALL_PLATE_SIZES, true)).toHaveLength(5);
  });

  it('opens with two empty-bar sets when includeBarSets is true', () => {
    const sets = getWarmupSets(100, 20, ALL_PLATE_SIZES, true);
    expect(sets[0].weight).toBe(20);
    expect(sets[1].weight).toBe(20);
    expect(sets.map((s) => s.weight)).toEqual([20, 20, 40, 60, 80]);
  });

  it('uses five ramp sets with no empty-bar sets when includeBarSets is false', () => {
    const sets = getWarmupSets(100, 20, ALL_PLATE_SIZES, false);
    expect(sets.every((s) => s.weight > 20)).toBe(true);
    expect(sets.map((s) => s.weight)).toEqual([30, 50, 60, 70, 90]);
  });

  it('never warms up at or above the working weight', () => {
    for (const w of [40, 60, 100, 142.5]) {
      for (const include of [true, false]) {
        const sets = getWarmupSets(w, 20, ALL_PLATE_SIZES, include);
        expect(sets.every((s) => s.weight < w)).toBe(true);
      }
    }
  });

  it('snaps ramp weights to whole 5 kg+ plate increments (no tiny-plate reloads)', () => {
    const sets = getWarmupSets(100, 20, ALL_PLATE_SIZES, false);
    // every warmup is loadable with 5 kg+ plates: (weight - bar) is a multiple of 10
    expect(sets.every((s) => (s.weight - 20) % 10 === 0)).toBe(true);
  });

  it('uses 5 reps on every warmup set', () => {
    const sets = getWarmupSets(100, 20, ALL_PLATE_SIZES, true);
    expect(sets.every((s) => s.reps === 5)).toBe(true);
  });
});

// =========================================================================
// exerciseSucceeded
// =========================================================================
describe('exerciseSucceeded', () => {
  it('is true only when every required set is completed', () => {
    const win = makeSession('2026-01-01', 'A', 'squat', 100, 5, 5);
    expect(exerciseSucceeded(win, 'squat')).toBe(true);
  });
  it('is false when a required set is missed', () => {
    const fail = makeSession('2026-01-01', 'A', 'squat', 100, 4, 5);
    expect(exerciseSucceeded(fail, 'squat')).toBe(false);
  });
  it('is false when there are too few sets', () => {
    const short = makeSession('2026-01-01', 'A', 'squat', 100, 3, 3);
    expect(exerciseSucceeded(short, 'squat')).toBe(false);
  });
  it('only needs a single set for the deadlift', () => {
    const dl = makeSession('2026-01-02', 'B', 'deadlift', 100, 1, 1);
    expect(exerciseSucceeded(dl, 'deadlift')).toBe(true);
  });
  it('is false when the exercise is absent', () => {
    const empty = { date: '2026-01-01', workoutType: 'A', exercises: {} };
    expect(exerciseSucceeded(empty, 'squat')).toBe(false);
  });
});

// =========================================================================
// countConsecutiveFailures
// =========================================================================
describe('countConsecutiveFailures', () => {
  it('counts back to the most recent success', () => {
    const sessions = [
      makeSession('2026-01-01', 'A', 'squat', 100, 5, 5), // success
      makeSession('2026-01-03', 'A', 'squat', 102.5, 4, 5), // fail
      makeSession('2026-01-05', 'A', 'squat', 102.5, 3, 5), // fail
    ];
    expect(countConsecutiveFailures(sessions, 'squat')).toBe(2);
  });
  it('resets to zero after a success', () => {
    const sessions = [
      makeSession('2026-01-01', 'A', 'squat', 100, 4, 5), // fail
      makeSession('2026-01-03', 'A', 'squat', 100, 5, 5), // success (most recent)
    ];
    expect(countConsecutiveFailures(sessions, 'squat')).toBe(0);
  });
  it('only considers workouts that contain the exercise', () => {
    // benchPress lives only in Workout A, so the Workout B session is skipped.
    const sessions = [
      makeSession('2026-01-01', 'A', 'benchPress', 60, 4, 5), // fail
      makeSession('2026-01-03', 'B', 'overheadPress', 40, 5, 5), // no bench
    ];
    expect(countConsecutiveFailures(sessions, 'benchPress')).toBe(1);
  });
});

// =========================================================================
// computeNextWeight
// =========================================================================
describe('computeNextWeight', () => {
  it('returns the starting weight when there is no history', () => {
    expect(computeNextWeight([], 'squat', 20)).toBe(20);
  });

  it('adds the increment after a success', () => {
    const sessions = [makeSession('2026-01-01', 'A', 'squat', 100, 5, 5)];
    expect(computeNextWeight(sessions, 'squat', 20)).toBe(102.5);
  });

  it('honors a custom increment', () => {
    const sessions = [makeSession('2026-01-01', 'A', 'squat', 100, 5, 5)];
    expect(computeNextWeight(sessions, 'squat', 20, 5)).toBe(105);
  });

  it('holds the weight after a single failure', () => {
    const sessions = [makeSession('2026-01-01', 'A', 'squat', 100, 4, 5)];
    expect(computeNextWeight(sessions, 'squat', 20)).toBe(100);
  });

  it('deloads 10% after three consecutive failures', () => {
    const sessions = [
      makeSession('2026-01-01', 'A', 'squat', 100, 4, 5),
      makeSession('2026-01-03', 'A', 'squat', 100, 4, 5),
      makeSession('2026-01-05', 'A', 'squat', 100, 4, 5),
    ];
    expect(computeNextWeight(sessions, 'squat', 20)).toBe(90);
  });

  it('reads the last RELEVANT session, not the global last session', () => {
    // benchPress is only in Workout A; the later Workout B session must not
    // reset bench progression.
    const sessions = [
      makeSession('2026-01-01', 'A', 'benchPress', 60, 5, 5), // bench success
      makeSession('2026-01-03', 'B', 'overheadPress', 40, 5, 5), // no bench after
    ];
    expect(computeNextWeight(sessions, 'benchPress', 20)).toBe(62.5);
  });
});
