import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  EXERCISES, getWorkoutType, getWorkoutExercises, getSetsReps,
  computeNextWeight, countConsecutiveFailures, formatPlates,
} from '../lib/program';
import { makeSessionId } from '../lib/db';
import WarmupCard from '../components/WarmupCard';

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function TodayView({ sessions, settings, upsertSession, onStartTimer }) {
  const [expandedWarmup, setExpandedWarmup] = useState(null);
  const [typeOverride, setTypeOverride] = useState(null);
  const [showSets, setShowSets] = useState(false);

  const date    = todayStr();
  const todayId = makeSessionId(date);

  const existingSession = useMemo(
    () => sessions.find((s) => s.id === todayId),
    [sessions, todayId],
  );

  const sessionIndex = useMemo(() => {
    const pastSessions = sessions.filter((s) => s.id !== todayId);
    return pastSessions.length;
  }, [sessions, todayId]);

  // Effective workout type: explicit override > saved session > computed from index
  const workoutType = typeOverride ?? existingSession?.workoutType ?? getWorkoutType(sessionIndex);
  const exercises   = getWorkoutExercises(workoutType);

  const pastSessions = useMemo(
    () => sessions.filter((s) => s.id !== todayId),
    [sessions, todayId],
  );

  const workingWeights = useMemo(() => {
    const result = {};
    for (const key of exercises) {
      result[key] = existingSession?.exercises?.[key]?.weight
        ?? computeNextWeight(pastSessions, key, settings.weights[key] ?? 20);
    }
    return result;
  }, [exercises, existingSession, pastSessions, settings.weights]);

  const [setResults, setSetResults] = useState(() => {
    if (existingSession) return existingSession.exercises ?? {};
    const init = {};
    for (const key of exercises) init[key] = { sets: [], weight: workingWeights[key] };
    return init;
  });

  // Sync setResults when existing session first loads
  useEffect(() => {
    if (existingSession) {
      setSetResults(existingSession.exercises ?? {});
    }
  }, [existingSession?.id]); // eslint-disable-line

  const buildSession = useCallback(
    (results) => ({
      id: todayId,
      date,
      sessionIndex,
      workoutType,
      exercises: results,
      completed: exercises.every((key) => {
        const { sets: total } = getSetsReps(key);
        return (results[key]?.sets?.length ?? 0) >= total;
      }),
    }),
    [todayId, date, sessionIndex, workoutType, exercises],
  );

  const persist = useCallback(
    async (results) => { await upsertSession(buildSession(results)); },
    [upsertSession, buildSession],
  );

  const switchType = useCallback((t) => {
    if (workoutType === t) return;
    const hasSets = Object.values(setResults).some((ex) => (ex?.sets?.length ?? 0) > 0);
    if (hasSets && !confirm(`Switch to Workout ${t}? Your current sets will be reset.`)) return;
    setTypeOverride(t);
    const newExercises = getWorkoutExercises(t);
    const init = {};
    for (const key of newExercises) {
      init[key] = { sets: [], weight: computeNextWeight(pastSessions, key, settings.weights?.[key] ?? 20) };
    }
    setSetResults(init);
  }, [workoutType, setResults, pastSessions, settings.weights]);

  const logSet = useCallback(
    async (exerciseKey, completed) => {
      const { sets: total } = getSetsReps(exerciseKey);
      const current = setResults[exerciseKey]?.sets ?? [];
      if (current.length >= total) return;

      const isLastSet = current.length + 1 >= total;

      const updated = {
        ...setResults,
        [exerciseKey]: {
          weight: workingWeights[exerciseKey],
          sets: [...current, { completed, ts: Date.now() }],
        },
      };
      setSetResults(updated);
      await persist(updated);

      // No timer after the final set of an exercise
      if (!isLastSet) {
        const ex = EXERCISES[exerciseKey];
        const restSecs =
          settings.restTimers?.[ex.isLower ? 'lower' : 'upper'] ??
          (ex.isLower ? 180 : 90);
        onStartTimer(restSecs);
      }
    },
    [setResults, workingWeights, persist, settings.restTimers, onStartTimer],
  );

  const undoLastSet = useCallback(
    async (exerciseKey) => {
      const current = setResults[exerciseKey]?.sets ?? [];
      if (current.length === 0) return;
      const updated = {
        ...setResults,
        [exerciseKey]: {
          ...setResults[exerciseKey],
          sets: current.slice(0, -1),
        },
      };
      setSetResults(updated);
      await persist(updated);
    },
    [setResults, persist],
  );

  const failures = useMemo(() => {
    const result = {};
    for (const key of exercises) result[key] = countConsecutiveFailures(pastSessions, key);
    return result;
  }, [pastSessions, exercises]);

  const allDone = exercises.every((key) => {
    const { sets: total } = getSetsReps(key);
    return (setResults[key]?.sets?.length ?? 0) >= total;
  });

  // Completion banner — shown instead of exercise cards
  if (allDone && !showSets) {
    const nextType = workoutType === 'A' ? 'B' : 'A';
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 2);
    const nextDay = nextDate.toLocaleDateString('en-US', { weekday: 'long' });

    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="bg-green-900/20 border border-green-800/50 rounded-2xl p-6 text-center space-y-4 mt-4">
          <div className="text-5xl">💪</div>
          <div className="font-bold text-green-400 text-2xl">Workout {workoutType} Done!</div>
          <div className="text-gray-500 text-sm">{date}</div>
          <div className="border-t border-green-900/40 pt-4 space-y-1.5">
            <div className="text-gray-400 text-sm">Next up</div>
            <div className="text-white font-bold text-xl">Workout {nextType}</div>
            <div className="text-gray-500 text-sm">
              Rest tomorrow · back {nextDay}
            </div>
          </div>
          <button
            onClick={() => setShowSets(true)}
            className="text-xs text-gray-600 hover:text-gray-400 underline pt-1"
          >
            View today's sets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Today</h1>
          <p className="text-gray-400 text-sm">{date}</p>
        </div>
        {allDone ? (
          <button
            onClick={() => setShowSets(false)}
            className="text-xs text-gray-500 hover:text-white px-3 py-1.5 bg-gray-800 rounded-xl"
          >
            ← Summary
          </button>
        ) : (
          <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
            {['A', 'B'].map((t) => (
              <button
                key={t}
                onClick={() => switchType(t)}
                className={`px-4 py-1.5 rounded-lg font-bold text-sm transition-colors ${
                  workoutType === t
                    ? t === 'A' ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Exercise cards */}
      {exercises.map((key) => {
        const ex     = EXERCISES[key];
        const weight = workingWeights[key];
        const { sets: totalSets, reps } = getSetsReps(key);
        const done       = setResults[key]?.sets ?? [];
        const isComplete = done.length >= totalSets;
        const f          = failures[key];

        const restSecs = settings.restTimers?.[ex.isLower ? 'lower' : 'upper'] ?? (ex.isLower ? 180 : 90);

        return (
          <div
            key={key}
            className={`bg-gray-900 rounded-2xl overflow-hidden transition-opacity ${
              isComplete ? 'opacity-60' : ''
            }`}
          >
            <div className="p-4 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold">{ex.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-2xl font-mono font-bold text-orange-400">
                      {weight}kg
                    </span>
                    <span className="text-gray-500 text-sm">
                      {totalSets}×{reps}
                    </span>
                    {f > 0 && (
                      <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full">
                        {f} fail{f > 1 ? 's' : ''}
                        {f >= 3 ? ' → deloaded' : ''}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {formatPlates(weight, settings.barWeight, settings.availablePlates)}
                  </div>
                </div>
                <button
                  onClick={() =>
                    setExpandedWarmup(expandedWarmup === key ? null : key)
                  }
                  className="text-xs text-gray-500 hover:text-gray-300 mt-1 px-2 py-1 bg-gray-800 rounded-lg shrink-0"
                >
                  Warmup
                </button>
              </div>

              {expandedWarmup === key && (
                <div className="mt-3">
                  <WarmupCard
                    workingWeight={weight}
                    barWeight={settings.barWeight}
                    availablePlates={settings.availablePlates}
                    includeBarSets={key !== 'deadlift' && key !== 'barbellRow'}
                    restSeconds={restSecs}
                    onStartWorkingSets={(secs) => {
                      setExpandedWarmup(null);
                      onStartTimer(secs);
                    }}
                  />
                </div>
              )}
            </div>

            <div className="px-4 pb-4 space-y-2">
              {/* Set buttons */}
              <div className="flex gap-2">
                {Array.from({ length: totalSets }).map((_, i) => {
                  const set    = done[i];
                  const isNext = i === done.length;
                  return (
                    <button
                      key={i}
                      disabled={!isNext}
                      onClick={() => isNext && logSet(key, true)}
                      className={`flex-1 h-14 rounded-xl font-bold text-lg transition-all ${
                        set?.completed === true
                          ? 'bg-green-600 text-white'
                          : set?.completed === false
                          ? 'bg-red-700 text-white'
                          : isNext
                          ? 'bg-orange-500 hover:bg-orange-400 text-white active:scale-95'
                          : 'bg-gray-800 text-gray-600'
                      }`}
                    >
                      {set?.completed === true
                        ? '✓'
                        : set?.completed === false
                        ? '✗'
                        : i + 1}
                    </button>
                  );
                })}
              </div>

              {/* Fail / undo row */}
              {done.length > 0 && (
                <div className="flex gap-2">
                  {!isComplete && (
                    <button
                      onClick={() => logSet(key, false)}
                      className="flex-1 h-10 rounded-xl text-sm font-medium bg-red-900/40 text-red-400 hover:bg-red-900/60"
                    >
                      Failed set
                    </button>
                  )}
                  <button
                    onClick={() => undoLastSet(key)}
                    className="px-4 h-10 rounded-xl text-sm font-medium bg-gray-800 text-gray-400 hover:bg-gray-700"
                  >
                    Undo
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
