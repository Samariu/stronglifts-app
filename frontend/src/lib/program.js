// StrongLifts 5x5 program constants and logic

export const EXERCISES = {
  squat:         { name: 'Squat',          increment: 2.5, restSeconds: 180, isLower: true  },
  benchPress:    { name: 'Bench Press',    increment: 2.5, restSeconds: 90,  isLower: false },
  barbellRow:    { name: 'Barbell Row',    increment: 2.5, restSeconds: 90,  isLower: false },
  overheadPress: { name: 'Overhead Press', increment: 2.5, restSeconds: 90,  isLower: false },
  deadlift:      { name: 'Deadlift',       increment: 5,   restSeconds: 180, isLower: true  },
};

export const ALL_PLATE_SIZES = [25, 20, 15, 10, 5, 2.5, 1.25];

export const WORKOUT_A = ['squat', 'benchPress', 'barbellRow'];
export const WORKOUT_B = ['squat', 'overheadPress', 'deadlift'];

export const getSetsReps = (exerciseKey) =>
  exerciseKey === 'deadlift' ? { sets: 1, reps: 5 } : { sets: 5, reps: 5 };

export const getWorkoutType      = (sessionIndex) => (sessionIndex % 2 === 0 ? 'A' : 'B');
export const getWorkoutExercises = (type)         => (type === 'A' ? WORKOUT_A : WORKOUT_B);

export const epley1RM       = (weight, reps) => weight * (1 + reps / 30);
export const roundToNearest = (value, step)  => Math.round(value / step) * step;
export const deload         = (weight)       => roundToNearest(weight * 0.9, 2.5);

// Whether a single exercise was fully completed in a session
export const exerciseSucceeded = (session, exerciseKey) => {
  const sets = session.exercises?.[exerciseKey]?.sets ?? [];
  const { sets: total } = getSetsReps(exerciseKey);
  return sets.length >= total && sets.slice(0, total).every((s) => s.completed);
};

// Consecutive failed workouts for an exercise
export const countConsecutiveFailures = (sessions, exerciseKey) => {
  let count = 0;
  const relevant = sessions
    .filter((s) => getWorkoutExercises(s.workoutType).includes(exerciseKey))
    .sort((a, b) => a.date.localeCompare(b.date));
  for (let i = relevant.length - 1; i >= 0; i--) {
    if (exerciseSucceeded(relevant[i], exerciseKey)) break;
    count++;
  }
  return count;
};

// Compute the working weight for the next session from history
export const computeNextWeight = (sessions, exerciseKey, settingWeight) => {
  const relevant = sessions
    .filter((s) => getWorkoutExercises(s.workoutType).includes(exerciseKey))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (relevant.length === 0) return settingWeight;

  const last       = relevant[relevant.length - 1];
  const lastWeight = last.exercises?.[exerciseKey]?.weight ?? settingWeight;

  let failures = 0;
  for (let i = relevant.length - 1; i >= 0; i--) {
    if (exerciseSucceeded(relevant[i], exerciseKey)) break;
    failures++;
  }

  if (failures >= 3)                      return deload(lastWeight);
  if (exerciseSucceeded(last, exerciseKey)) return lastWeight + EXERCISES[exerciseKey].increment;
  return lastWeight;
};

// Plates per side — uses availablePlates from settings (falls back to all plates)
export const getPlatesPerSide = (targetWeight, barWeight = 20, availablePlates = ALL_PLATE_SIZES) => {
  const sorted  = [...availablePlates].sort((a, b) => b - a); // largest first
  let remaining = (targetWeight - barWeight) / 2;
  const plates  = [];
  if (remaining < 0) return plates;
  for (const plate of sorted) {
    while (remaining >= plate - 0.001) {
      plates.push(plate);
      remaining -= plate;
      remaining  = Math.round(remaining * 1000) / 1000;
    }
  }
  return plates;
};

export const formatPlates = (targetWeight, barWeight = 20, availablePlates = ALL_PLATE_SIZES) => {
  const plates = getPlatesPerSide(targetWeight, barWeight, availablePlates);
  if (plates.length === 0) return 'Bar only';
  const counts = {};
  for (const p of plates) counts[p] = (counts[p] || 0) + 1;
  return Object.entries(counts).map(([p, c]) => `${c}×${p}kg`).join(' + ');
};

// Warmup sets following the StrongLifts protocol:
//   - Squat / Bench / OHP (includeBarSets=true):  2 × empty bar, then 3 evenly-spaced ramp sets
//   - Deadlift / Barbell Row (includeBarSets=false): 3 evenly-spaced ramp sets only
// Ramp steps are at 25 %, 50 %, 75 % of the range between bar and working weight,
// each rounded to the nearest achievable weight given the smallest available plate.
export const getWarmupSets = (workingWeight, barWeight = 20, availablePlates = ALL_PLATE_SIZES, includeBarSets = true) => {
  if (workingWeight <= barWeight) return [];

  const smallestPlate = Math.min(...availablePlates);
  const step = smallestPlate * 2;

  const roundToAchievable = (raw) => {
    const diff = Math.max(0, raw - barWeight);
    return barWeight + Math.round(diff / step) * step;
  };

  const sets = [];
  if (includeBarSets) {
    sets.push({ weight: barWeight, reps: 5 });
    sets.push({ weight: barWeight, reps: 5 });
  }

  // 3 ramp steps evenly spaced between bar and working weight
  const seen = new Set(sets.map((s) => s.weight));
  for (let i = 1; i <= 3; i++) {
    const raw = barWeight + (workingWeight - barWeight) * (i / 4); // 25 %, 50 %, 75 %
    const w   = roundToAchievable(raw);
    if (w >= workingWeight) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    sets.push({ weight: w, reps: 5 });
  }

  return sets;
};
