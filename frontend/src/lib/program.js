// StrongLifts 5x5 program constants and logic

export const EXERCISES = {
  squat:          { name: 'Squat',                increment: 2.5, restSeconds: 180, isLower: true  },
  benchPress:     { name: 'Bench Press',          increment: 2.5, restSeconds: 90,  isLower: false },
  barbellRow:     { name: 'Barbell Row',          increment: 2.5, restSeconds: 90,  isLower: false },
  overheadPress:  { name: 'Overhead Press',       increment: 2.5, restSeconds: 90,  isLower: false },
  deadlift:       { name: 'Deadlift',             increment: 5,   restSeconds: 180, isLower: true  },
  inclineBench:   { name: 'Incline Bench Press',  increment: 2.5, restSeconds: 90,  isLower: false },
  closeGripBench: { name: 'Close-Grip Bench',     increment: 2.5, restSeconds: 90,  isLower: false },
};

export const ALL_PLATE_SIZES = [25, 20, 15, 10, 5, 2.5, 1.25];

export const WORKOUT_A = ['squat', 'benchPress', 'barbellRow'];
export const WORKOUT_B = ['squat', 'overheadPress', 'deadlift'];

// Sets/reps for an exercise. When a `program` is supplied, the scheme is read
// from the workout that contains the exercise (so e.g. Intermediate Rows are
// 5×8 and Intermediate Deadlift is 5×5). Without a program it falls back to the
// classic StrongLifts 5×5 rule (Deadlift 1×5, everything else 5×5), which keeps
// every existing call site working unchanged.
export const getSetsReps = (exerciseKey, program) => {
  if (program) {
    for (const label of program.cycle) {
      const found = program.workouts[label]?.exercises.find((e) => e.key === exerciseKey);
      if (found) return { sets: found.sets, reps: found.reps };
    }
  }
  return exerciseKey === 'deadlift' ? { sets: 1, reps: 5 } : { sets: 5, reps: 5 };
};

// Smallest sensible working weight for an exercise.
// Deadlift and Barbell Row need a plate on each side to raise the bar to
// pulling height, so their minimum is bar + 5 kg per side (e.g. 30 kg).
export const getMinWeight = (exerciseKey, barWeight = 20) =>
  exerciseKey === 'deadlift' || exerciseKey === 'barbellRow'
    ? barWeight + 10
    : barWeight;

// Rest time (seconds) for an exercise, with fallbacks for the legacy
// upper/lower restTimers shape and the per-exercise program defaults.
export const getRestSeconds = (restTimers, exerciseKey) => {
  const ex = EXERCISES[exerciseKey];
  const perExercise = restTimers?.[exerciseKey];
  if (perExercise != null) return perExercise;
  const legacy = restTimers?.[ex.isLower ? 'lower' : 'upper'];
  if (legacy != null) return legacy;
  return ex.restSeconds;
};

// Workout label for a given session index, rotating through the program's cycle.
// Defaults to the 5×5 A/B alternation when no program is given.
export const getWorkoutType = (sessionIndex, program) => {
  const cycle = program?.cycle ?? ['A', 'B'];
  return cycle[((sessionIndex % cycle.length) + cycle.length) % cycle.length];
};

// Exercise keys for a workout label. Defaults to the 5×5 A/B workouts.
export const getWorkoutExercises = (type, program) => {
  if (program) return (program.workouts[type]?.exercises ?? []).map((e) => e.key);
  return type === 'A' ? WORKOUT_A : WORKOUT_B;
};

export const epley1RM       = (weight, reps) => weight * (1 + reps / 30);
export const roundToNearest = (value, step)  => Math.round(value / step) * step;
export const deload         = (weight)       => roundToNearest(weight * 0.9, 2.5);

// Whether a single exercise was fully completed in a session
export const exerciseSucceeded = (session, exerciseKey, program) => {
  const sets = session.exercises?.[exerciseKey]?.sets ?? [];
  const { sets: total } = getSetsReps(exerciseKey, program);
  return sets.length >= total && sets.slice(0, total).every((s) => s.completed);
};

// Consecutive failed workouts for an exercise. Relevance is determined by what a
// session *actually contains* (Object presence) rather than re-deriving from the
// workout label — this stays correct across program switches and ignores
// sessions where the exercise wasn't performed.
export const countConsecutiveFailures = (sessions, exerciseKey, program) => {
  let count = 0;
  const relevant = sessions
    .filter((s) => s.exercises && exerciseKey in s.exercises)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (let i = relevant.length - 1; i >= 0; i--) {
    if (exerciseSucceeded(relevant[i], exerciseKey, program)) break;
    count++;
  }
  return count;
};

// Compute the working weight for the next session from history.
// Pass a custom increment to override the exercise default (e.g., from settings.increments),
// and a program so success is judged against the right set/rep scheme.
export const computeNextWeight = (
  sessions,
  exerciseKey,
  settingWeight,
  increment = EXERCISES[exerciseKey]?.increment ?? 2.5,
  program,
) => {
  const relevant = sessions
    .filter((s) => s.exercises && exerciseKey in s.exercises)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (relevant.length === 0) return settingWeight;

  const last       = relevant[relevant.length - 1];
  const lastWeight = last.exercises?.[exerciseKey]?.weight ?? settingWeight;

  const failures = countConsecutiveFailures(sessions, exerciseKey, program);

  if (failures >= 3)                                 return deload(lastWeight);
  if (exerciseSucceeded(last, exerciseKey, program)) return lastWeight + increment;
  return lastWeight;
};

// Heaviest weight ever logged for an exercise with at least one completed set.
// Returns null when the exercise has no history — used for PR detection.
export const bestLoggedWeight = (sessions, exerciseKey) => {
  let best = null;
  for (const s of sessions) {
    const ex = s.exercises?.[exerciseKey];
    if (!ex || ex.weight == null) continue;
    if (!(ex.sets ?? []).some((set) => set.completed)) continue;
    if (best === null || ex.weight > best) best = ex.weight;
  }
  return best;
};

// Current workout streak: consecutive sessions (walking back from the latest)
// whose gap to the previous session is at most maxGapDays. Tolerates the
// 3×/week cadence (a weekend gap is 3 days). Sessions without logged sets are
// ignored.
export const computeStreak = (sessions, maxGapDays = 4) => {
  const dates = [...new Set(
    sessions
      .filter((s) => Object.values(s.exercises ?? {}).some((ex) => (ex.sets ?? []).length > 0))
      .map((s) => s.date),
  )].sort();
  if (dates.length === 0) return 0;
  let streak = 1;
  for (let i = dates.length - 1; i > 0; i--) {
    const gap = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
    if (gap > maxGapDays) break;
    streak++;
  }
  return streak;
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

// Warmup sets following the StrongLifts protocol — ALWAYS exactly 5 sets × 5 reps:
//   - Squat / Bench / OHP (includeBarSets=true):  2 × empty bar, then 3 ramp sets
//   - Deadlift / Barbell Row (includeBarSets=false): 5 ramp sets
// Ramp steps are evenly spaced between bar and working weight, snapped to whole
// 5 kg+ plates only (no reloading the bar with tiny 1.25/2.5 kg plates). When two
// ramp steps snap to the same weight they are kept as separate sets — the set
// count stays 5, you just don't change the bar between them.
export const getWarmupSets = (workingWeight, barWeight = 20, availablePlates = ALL_PLATE_SIZES, includeBarSets = true) => {
  if (workingWeight <= barWeight) return [];

  // Warmups round to whole 5 kg+ plates; small plates (2.5/1.25 kg) are skipped.
  const warmupPlates  = availablePlates.filter((p) => p >= 5);
  const smallestPlate = Math.min(...(warmupPlates.length ? warmupPlates : availablePlates));
  const step = smallestPlate * 2;

  // Snap a raw weight to a 5 kg+ plate increment, kept between bar and working weight.
  const snap = (raw) => {
    const diff = Math.max(0, raw - barWeight);
    let w = barWeight + Math.round(diff / step) * step;
    if (w >= workingWeight) w = workingWeight - step; // never warm up at/above the work weight
    return Math.max(barWeight, w);
  };

  const sets = [];
  if (includeBarSets) {
    sets.push({ weight: barWeight, reps: 5 });
    sets.push({ weight: barWeight, reps: 5 });
  }

  // Ramp steps evenly spaced between bar and working weight — 3 with bar sets,
  // 5 without, so the total is always exactly 5 sets.
  const rampCount = includeBarSets ? 3 : 5;
  for (let i = 1; i <= rampCount; i++) {
    const raw = barWeight + (workingWeight - barWeight) * (i / (rampCount + 1));
    sets.push({ weight: snap(raw), reps: 5 });
  }

  return sets;
};
