import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  EXERCISES, getWorkoutType, getWorkoutExercises, getSetsReps,
  computeNextWeight, countConsecutiveFailures, formatPlates,
} from '../lib/program';
import { makeSessionId } from '../lib/db';
import RestTimer from '../components/RestTimer';
import WarmupCard from '../components/WarmupCard';

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function TodayView({ sessions, settings, upsertSession }) {
  const [expandedWarmup, setExpandedWarmup] = useState(null);
  const [showTimer, setShowTimer] = useState(null);
  const [timerKey, setTimerKey] = useState(0);

  const date = todayStr();
  const todayId = makeSessionId(date);

  // Today's session already saved?
  const existingSession = useMemo(
    () => sessions.find((s) => s.id === todayId),
    [sessions, todayId],
  );

  // Next session index = number of completed sessions so far
  // If there is already a session for today, don't count it twice
  const sessionIndex = useMemo(() => {
    const pastSessions = sessions.filter((s) => s.id !== todayId);
    return pastSessions.length;
  }, [sessions, todayId]);

  const workoutType = getWorkoutType(sessionIndex);
  const exercises   = getWorkoutExercises(workoutType);

  // Compute working weights from history (excl. today so we don't double-count)
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

  // Set results — loaded from existing session if present
  const [setResults, setSetResults] = useState(() => {
    if (existingSession) return existingSession.exercises ?? {};
    const init = {};
    for (const key of exercises) init[key] = { sets: [], weight: workingWeights[key] };
    return init;
  });

  // Keep local state in sync if an existing session loads late
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
    async (results) => {
      await upsertSession(buildSession(results));
    },
    [upsertSession, buildSession],
  );

  const logSet = useCallback(
    async (exerciseKey, completed) => {
      const { sets: total } = getSetsReps(exerciseKey);
      const current = setResults[exerciseKey]?.sets ?? [];
      if (current.length >= total) return;

      const updated = {
        ...setResults,
        [exerciseKey]: {
          weight: workingWeights[exerciseKey],
          sets: [...current, { completed, ts: Date.now() }],
        },
      };
      setSetResults(updated);
      await persist(updated);

      // Start rest timer
      const ex = EXERCISES[exerciseKey];
      const restSecs =
        settings.restTimers?.[ex.isLower ? 'lower' : 'upper'] ??
        (ex.isLower ? 180 : 90);
      setShowTimer({ seconds: restSecs });
      setTimerKey((k) => k + 1);
    },
    [setResults, workingWeights, persist, settings.restTimers],
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

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Today</h1>
          <p className="text-gray-400 text-sm">{date}</p>
        </div>
        <div
          className={`px-4 py-2 rounded-full font-bold text-sm ${
            workoutType === 'A'
              ? 'bg-orange-500/20 text-orange-400'
              : 'bg-blue-500/20 text-blue-400'
          }`}
        >
          Workout {workoutType}
        </div>
      </div>

      {/* Rest timer */}
      {showTimer && (
        <div className="bg-gray-900 rounded-2xl px-4 pb-2">
          <div className="text-xs text-gray-500 pt-3 text-center uppercase tracking-wider">
            Rest Timer
          </div>
          <RestTimer key={timerKey} seconds={showTimer.seconds} onDone={() => {}} />
          <button
            onClick={() => setShowTimer(null)}
            className="w-full text-xs text-gray-600 pb-2 hover:text-gray-400"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Exercise cards */}
      {exercises.map((key) => {
        const ex     = EXERCISES[key];
        const weight = workingWeights[key];
        const { sets: totalSets, reps } = getSetsReps(key);
        const done       = setResults[key]?.sets ?? [];
        const isComplete = done.length >= totalSets;
        const f          = failures[key];

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

      {/* Completion banner */}
      {allDone && (
        <div className="bg-green-900/30 border border-green-800 rounded-2xl p-5 text-center space-y-1">
          <div className="text-3xl">🎉</div>
          <div className="font-bold text-green-400 text-lg">Workout Complete!</div>
          <div className="text-gray-400 text-sm">
            Rest. Come back in 48h for Workout{' '}
            {workoutType === 'A' ? 'B' : 'A'}.
          </div>
        </div>
      )}
    </div>
  );
}
