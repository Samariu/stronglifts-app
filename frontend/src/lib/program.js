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

// Defined here (not in units.js) so formatPlates can label lb plates without a
// circular import — lib/units.js re-exports it as the canonical name.
export const KG_PER_LB = 0.45359237;

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
// pulling height; platePair is the weight of that smallest full-size pair
// (2 × 5 kg by default; the lb profile passes 2 × 10 lb).
export const getMinWeight = (exerciseKey, barWeight = 20, platePair = 10) =>
  exerciseKey === 'deadlift' || exerciseKey === 'barbellRow'
    ? barWeight + platePair
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
// 10% deload, snapped to the smallest loadable step (2.5 kg default; the lb
// profile passes its 5 lb equivalent).
export const deload         = (weight, step = 2.5) => roundToNearest(weight * 0.9, step);

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

// Successful workouts in a row at the weight last used for an exercise. Resets
// on a failure or on any weight change (including a deload), so it answers
// "how many times have I now cleared *this* weight?".
// Weights are compared with a tolerance: the lb profile stores exact kg values
// that don't land on clean decimals.
export const countSuccessesAtWeight = (sessions, exerciseKey, program) => {
  const relevant = sessions
    .filter((s) => s.exercises && exerciseKey in s.exercises)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (relevant.length === 0) return 0;

  const weightOf   = (s) => s.exercises?.[exerciseKey]?.weight;
  const lastWeight = weightOf(relevant[relevant.length - 1]);

  let count = 0;
  for (let i = relevant.length - 1; i >= 0; i--) {
    const w = weightOf(relevant[i]);
    if (w == null || Math.abs(w - lastWeight) > 1e-6) break;
    if (!exerciseSucceeded(relevant[i], exerciseKey, program)) break;
    count++;
  }
  return count;
};

// Compute the working weight for the next session from history.
// Pass a custom increment to override the exercise default (e.g., from settings.increments),
// and a program so success is judged against the right set/rep scheme.
// `incrementEvery` is how many successful workouts at a weight are needed before
// it goes up — 1 is classic linear progression, 3 is "add weight every 3rd time".
export const computeNextWeight = (
  sessions,
  exerciseKey,
  settingWeight,
  increment = EXERCISES[exerciseKey]?.increment ?? 2.5,
  program,
  roundStep = 2.5,
  incrementEvery = 1,
) => {
  const relevant = sessions
    .filter((s) => s.exercises && exerciseKey in s.exercises)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (relevant.length === 0) return settingWeight;

  const last       = relevant[relevant.length - 1];
  const lastWeight = last.exercises?.[exerciseKey]?.weight ?? settingWeight;

  const failures = countConsecutiveFailures(sessions, exerciseKey, program);

  if (failures >= 3) return deload(lastWeight, roundStep);
  if (!exerciseSucceeded(last, exerciseKey, program)) return lastWeight;

  // Hold the weight until it has been cleared `every` times in a row.
  const every = Math.max(1, Math.round(incrementEvery || 1));
  if (countSuccessesAtWeight(relevant, exerciseKey, program) < every) return lastWeight;

  return lastWeight + increment;
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

export const formatPlates = (targetWeight, barWeight = 20, availablePlates = ALL_PLATE_SIZES, unit = 'kg') => {
  const plates = getPlatesPerSide(targetWeight, barWeight, availablePlates);
  if (plates.length === 0) return 'Bar only';
  const counts = {};
  for (const p of plates) counts[p] = (counts[p] || 0) + 1;
  const label = (kg) =>
    unit === 'lb' ? `${Math.round((kg / KG_PER_LB) * 10) / 10}lb` : `${kg}kg`;
  return Object.entries(counts).map(([p, c]) => `${c}×${label(Number(p))}`).join(' + ');
};

// --- Warmup ----------------------------------------------------------------

// Where the Deadlift ramp aims to start, as a fraction of the working weight,
// before being clamped to the loadable floor band below. Taken from StrongLifts'
// own worked example: a 355 lb pull starts at 135 lb (38%).
const RAMP_START_FRACTION = 0.4;

// Hard ceiling on warmup sets. Past this the jumps simply get bigger — a very
// heavy pull shouldn't produce a ten-set warmup.
export const WARMUP_MAX_SETS = 6;

// Ramp options for an exercise, or null when it uses the classic fixed warmup.
// Deadlift only for now; the ramp algorithm handles bar-start lifts too, so
// moving another exercise onto it is a one-line change here.
export const getWarmupRamp = (exerciseKey, profile) =>
  exerciseKey === 'deadlift'
    ? {
        maxStep:  profile?.warmupMaxStep  ?? 20,
        floorMin: profile?.warmupFloorMin ?? 30,
        floorMax: profile?.warmupFloorMax ?? 60,
        maxSets:  WARMUP_MAX_SETS,
      }
    : null;

// Every weight loadable on the bar with `plates` (unlimited pairs), up to `max`.
// Ramp weights snap onto this rather than onto an arithmetic grid because lb
// denominations (45/35/25/10) aren't evenly spaced — a fixed step would produce
// weights you can't actually load.
const loadableWeights = (barWeight, max, plates) => {
  const perSide = (max - barWeight) / 2;
  // Keyed on a rounded value to dedupe, but the exact sum is what's kept: lb
  // plates are stored as inexact kg, and rounding them would blur the exact
  // ties that snapToLoadable relies on.
  const sums = new Map([[0, 0]]);
  if (perSide > 0) {
    const stack = [0];
    while (stack.length) {
      const sum = stack.pop();
      for (const plate of plates) {
        const next = sum + plate;
        const key  = Math.round(next * 1e6);
        if (next <= perSide + 1e-9 && !sums.has(key)) {
          sums.set(key, next);
          stack.push(next);
        }
      }
    }
  }
  return [...sums.values()].sort((a, b) => a - b).map((sum) => barWeight + 2 * sum);
};

// Nearest loadable weight to `raw`, ties rounding up — which is what reproduces
// StrongLifts' published 225 lb squat ramp, where 90 and 180 become 95 and 185.
const snapToLoadable = (raw, candidates) => {
  let best = candidates[0];
  for (const weight of candidates) {
    const delta = Math.abs(weight - raw) - Math.abs(best - raw);
    if (delta < -1e-9 || (Math.abs(delta) < 1e-9 && weight > best)) best = weight;
  }
  return best;
};

// Progressive "ramp up" warmup, reconstructed from the StrongLifts warmup
// calculator. The jump between sets is capped (20 kg / 45 lb), so the NUMBER of
// sets scales with the working weight instead of being fixed — which is the
// whole point of their calculator: the warmup for a 225 lb squat isn't the same
// as for a 300 lb one. Reps stay at 5 throughout.
//
// Reproduces StrongLifts' own published example exactly: a 225 lb squat gives
// 45, 45, 95, 135, 185 lb. See the tests.
const getRampWarmupSets = (workingWeight, barWeight, plates, includeBarSets, ramp) => {
  const { maxStep, floorMin, floorMax, maxSets = WARMUP_MAX_SETS } = ramp;

  const loadable = loadableWeights(barWeight, workingWeight, plates);

  // Squat/Bench/OHP start on the empty bar. Deadlift and Row need the plates to
  // reach the floor, so they start partway up, clamped to the band StrongLifts
  // documents (65-135 lb / 30-60 kg).
  const start = includeBarSets
    ? barWeight
    : snapToLoadable(
        Math.min(Math.max(workingWeight * RAMP_START_FRACTION, floorMin), floorMax),
        loadable,
      );

  // Nothing to ramp through when the work weight is already at the floor.
  if (workingWeight <= start) return [];

  // A ramp set is never at or above the work weight.
  const below = loadable.filter((w) => w < workingWeight - 1e-9);
  if (below.length === 0) return [];

  const span = workingWeight - start;
  // Enough intervals that no jump exceeds maxStep, bounded by the set cap. The
  // two empty-bar sets count toward that cap.
  const room = Math.max(1, includeBarSets ? maxSets - 1 : maxSets);
  const steps = Math.min(Math.max(1, Math.ceil(span / maxStep - 1e-9)), room);

  const sets = [];
  if (includeBarSets) {
    sets.push({ weight: barWeight, reps: 5 });
    sets.push({ weight: barWeight, reps: 5 });
  }
  // i starts at 1 for bar-start lifts because the empty-bar sets already cover i=0.
  for (let i = includeBarSets ? 1 : 0; i < steps; i++) {
    sets.push({ weight: snapToLoadable(start + (span * i) / steps, below), reps: 5 });
  }
  return sets;
};

// Warmup sets. Two schemes:
//
//   ramp = null (default) — the classic fixed scheme: ALWAYS exactly 5 sets × 5
//     reps. Squat/Bench/OHP (includeBarSets=true) open with 2 empty-bar sets then
//     3 ramp sets; Deadlift/Row (includeBarSets=false) get 5 ramp sets. Steps are
//     evenly spaced and snapped to whole 5 kg+ plates; when two steps snap to the
//     same weight they are kept as separate sets.
//
//   ramp = { maxStep, floorMin, floorMax, maxSets } — the progressive ramp
//     reconstructed from the StrongLifts warmup calculator, where the set count
//     scales with the load. Currently wired up for the Deadlift only
//     (see getWarmupRamp).
export const getWarmupSets = (workingWeight, barWeight = 20, availablePlates = ALL_PLATE_SIZES, includeBarSets = true, minWarmupPlate = 5, ramp = null) => {
  if (workingWeight <= barWeight) return [];

  // Warmups round to whole full-size plates; small plates (2.5/1.25 kg or
  // 2.5/5 lb) are skipped. The lb profile passes its own threshold.
  const warmupPlates  = availablePlates.filter((p) => p >= minWarmupPlate);
  const plates        = warmupPlates.length ? warmupPlates : availablePlates;

  if (ramp) return getRampWarmupSets(workingWeight, barWeight, plates, includeBarSets, ramp);

  const smallestPlate = Math.min(...plates);
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
