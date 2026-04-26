// StrongLifts 5x5 program constants and logic

export const EXERCISES = {
  squat:         { name: 'Squat',          increment: 2.5, restSeconds: 180, isLower: true  },
  benchPress:    { name: 'Bench Press',    increment: 2.5, restSeconds: 90,  isLower: false },
  barbellRow:    { name: 'Barbell Row',    increment: 2.5, restSeconds: 90,  isLower: false },
  overheadPress: { name: 'Overhead Press', increment: 2.5, restSeconds: 90,  isLower: false },
  deadlift:      { name: 'Deadlift',       increment: 5,   restSeconds: 180, isLower: true  },
};

export const WORKOUT_A = ['squat', 'benchPress', 'barbellRow'];
export const WORKOUT_B = ['squat', 'overheadPress', 'deadlift'];

// Deadlift is 1×5, everything else is 5×5
export const getSetsReps = (exerciseKey) =>
  exerciseKey === 'deadlift' ? { sets: 1, reps: 5 } : { sets: 5, reps: 5 };

export const getWorkoutType  = (sessionIndex) => (sessionIndex % 2 === 0 ? 'A' : 'B');
export const getWorkoutExercises = (type) => (type === 'A' ? WORKOUT_A : WORKOUT_B);

export const epley1RM      = (weight, reps) => weight * (1 + reps / 30);
export const roundToNearest = (value, step) => Math.round(value / step) * step;
export const deload         = (weight)      => roundToNearest(weight * 0.9, 2.5);

// Whether a single exercise was fully completed in a session
export const exerciseSucceeded = (session, exerciseKey) => {
  const sets = session.exercises?.[exerciseKey]?.sets ?? [];
  const { sets: total } = getSetsReps(exerciseKey);
  return sets.length >= total && sets.slice(0, total).every((s) => s.completed);
};

// Consecutive failed workouts for an exercise (only sessions that include it)
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

// Compute the working weight for an exercise for the NEXT session,
// derived entirely from session history. Falls back to settingWeight (from setup).
export const computeNextWeight = (sessions, exerciseKey, settingWeight) => {
  const relevant = sessions
    .filter((s) => getWorkoutExercises(s.workoutType).includes(exerciseKey))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (relevant.length === 0) return settingWeight;

  const last = relevant[relevant.length - 1];
  const lastWeight = last.exercises?.[exerciseKey]?.weight ?? settingWeight;

  // Count consecutive failures up to and including last session
  let failures = 0;
  for (let i = relevant.length - 1; i >= 0; i--) {
    if (exerciseSucceeded(relevant[i], exerciseKey)) break;
    failures++;
  }

  if (failures >= 3) return deload(lastWeight);
  if (exerciseSucceeded(last, exerciseKey)) return lastWeight + EXERCISES[exerciseKey].increment;
  return lastWeight;
};

// Warmup sets leading up to working weight
export const getWarmupSets = (workingWeight, barWeight = 20) => {
  if (workingWeight <= barWeight + 5) return [];
  return [
    { weight: barWeight,                                      reps: 5, label: 'Bar' },
    { weight: roundToNearest(workingWeight * 0.4, 2.5),       reps: 5, label: '40%' },
    { weight: roundToNearest(workingWeight * 0.6, 2.5),       reps: 3, label: '60%' },
    { weight: roundToNearest(workingWeight * 0.8, 2.5),       reps: 2, label: '80%' },
  ].filter((s, i, arr) => {
    if (s.weight < barWeight)     return false;
    if (s.weight >= workingWeight) return false;
    if (i > 0 && s.weight <= arr[i - 1].weight) return false;
    return true;
  });
};

// Plates per side for a given total weight
export const getPlatesPerSide = (targetWeight, barWeight = 20) => {
  const available = [25, 20, 15, 10, 5, 2.5, 1.25];
  let remaining = (targetWeight - barWeight) / 2;
  const plates = [];
  if (remaining < 0) return plates;
  for (const plate of available) {
    while (remaining >= plate - 0.001) {
      plates.push(plate);
      remaining -= plate;
      remaining = Math.round(remaining * 1000) / 1000;
    }
  }
  return plates;
};

export const formatPlates = (targetWeight, barWeight = 20) => {
  const plates = getPlatesPerSide(targetWeight, barWeight);
  if (plates.length === 0) return 'Bar only';
  const counts = {};
  for (const p of plates) counts[p] = (counts[p] || 0) + 1;
  return Object.entries(counts).map(([p, c]) => `${c}×${p}kg`).join(' + ');
};
