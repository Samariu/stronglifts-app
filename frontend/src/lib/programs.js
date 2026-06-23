// Workout program registry + accessory catalog.
//
// `program.js` is the pure-function engine (progression, plate math, warmups);
// this module holds the *declarative data* that describes each program. Adding a
// new program is mostly a matter of adding an entry to PROGRAMS — the engine and
// views read it generically.
import { EXERCISES } from './program';

export const DEFAULT_PROGRAM_ID = '5x5';

export const PROGRAMS = {
  '5x5': {
    id: '5x5',
    name: 'StrongLifts 5×5',
    description: 'Two workouts, three days a week. Add weight every session.',
    schedule: { dows: [2, 4, 6] }, // Tue / Thu / Sat — drives the History projection
    cycle: ['A', 'B'],             // ordered workout labels the program rotates through
    workouts: {
      A: {
        name: 'Workout A',
        exercises: [
          { key: 'squat', sets: 5, reps: 5 },
          { key: 'benchPress', sets: 5, reps: 5 },
          { key: 'barbellRow', sets: 5, reps: 5 },
        ],
      },
      B: {
        name: 'Workout B',
        exercises: [
          { key: 'squat', sets: 5, reps: 5 },
          { key: 'overheadPress', sets: 5, reps: 5 },
          { key: 'deadlift', sets: 1, reps: 5 },
        ],
      },
    },
  },

  '5x5-intermediate': {
    id: '5x5-intermediate',
    name: 'StrongLifts 5×5 Intermediate',
    description:
      'For when squatting 3×/week is too much. Lower Squat frequency, heavier Rows (5×8), Deadlift 5×5, and two bench variations.',
    schedule: { dows: [2, 4, 6] },
    cycle: ['A', 'B'],
    workouts: {
      A: {
        name: 'Workout A',
        exercises: [
          { key: 'squat', sets: 5, reps: 5 },
          { key: 'benchPress', sets: 5, reps: 5 },
          { key: 'barbellRow', sets: 5, reps: 8 }, // heavier rows
        ],
      },
      B: {
        name: 'Workout B',
        exercises: [
          { key: 'deadlift', sets: 5, reps: 5 }, // deadlift first, now 5×5
          { key: 'inclineBench', sets: 5, reps: 5 },
          { key: 'closeGripBench', sets: 5, reps: 5 },
        ],
      },
    },
  },
};

// Optional assistance work the user can bolt onto any workout. Stored in the
// same session.exercises map (flagged accessory:true) but excluded from barbell
// progression and stats — see isAccessory / isBarbell.
export const ACCESSORIES = {
  chinUp: { name: 'Chin-up', defaultSets: 3, unit: 'reps', bodyweight: true },
  dip: { name: 'Dip', defaultSets: 3, unit: 'reps', bodyweight: true },
  curl: { name: 'Barbell Curl', defaultSets: 3, unit: 'kg' },
  skullcrusher: { name: 'Skullcrusher', defaultSets: 3, unit: 'kg' },
  plank: { name: 'Plank', defaultSets: 3, unit: 'sec', bodyweight: true },
  hangingKneeRaise: { name: 'Hanging Knee Raise', defaultSets: 3, unit: 'reps', bodyweight: true },
  hyperextension: { name: 'Hyperextension', defaultSets: 3, unit: 'reps', bodyweight: true },
};

// Resolve a program by id, falling back to the default so the app never breaks
// on an unknown/legacy id.
export const getProgram = (id) => PROGRAMS[id] ?? PROGRAMS[DEFAULT_PROGRAM_ID];

export const getActiveProgram = (settings) => getProgram(settings?.program);

// Unique exercise keys across all of a program's workouts, in first-seen order.
// Used to drive the per-exercise settings sections and the setup wizard.
export const getProgramExerciseKeys = (program) => {
  const keys = [];
  for (const label of program.cycle) {
    for (const ex of program.workouts[label]?.exercises ?? []) {
      if (!keys.includes(ex.key)) keys.push(ex.key);
    }
  }
  return keys;
};

export const isAccessory = (key) => key in ACCESSORIES;
export const isBarbell = (key) => key in EXERCISES;
export const getExerciseMeta = (key) => EXERCISES[key] ?? ACCESSORIES[key];
