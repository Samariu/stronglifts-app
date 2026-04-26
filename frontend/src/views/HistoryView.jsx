import { useState, useMemo } from 'react';
import {
  EXERCISES, getWorkoutExercises, getWorkoutType, getSetsReps,
} from '../lib/program';
import { makeSessionId } from '../lib/db';

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfMonth(year, month) { return new Date(year, month, 1).getDay(); }

export default function HistoryView({ sessions, settings, upsertSession, removeSession }) {
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [editing,   setEditing]   = useState(null); // { date, session | null }

  const sessionsByDate = useMemo(() => {
    const map = {};
    for (const s of sessions) map[s.date] = s;
    return map;
  }, [sessions]);

  const todayStr = now.toISOString().slice(0, 10);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const days     = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const monthStr = new Date(viewYear, viewMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  const openEditor = (dateStr) => {
    if (dateStr > todayStr) return;
    setEditing({ date: dateStr, session: sessionsByDate[dateStr] ?? null });
  };

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">History</h1>

      <div className="bg-gray-900 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-800 rounded-xl">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-semibold">{monthStr}</span>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-800 rounded-xl">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-600 font-medium">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <div key={d}>{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: days }).map((_, i) => {
            const day      = i + 1;
            const dateStr  = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const session  = sessionsByDate[dateStr];
            const isToday  = dateStr === todayStr;
            const isFuture = dateStr > todayStr;

            let bg = 'bg-gray-800 text-gray-600';
            if (session?.workoutType === 'A') bg = 'bg-orange-600 text-white';
            else if (session?.workoutType === 'B') bg = 'bg-blue-600 text-white';

            return (
              <button
                key={day}
                onClick={() => openEditor(dateStr)}
                disabled={isFuture}
                className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${bg} ${
                  isToday ? 'ring-2 ring-white/50' : ''
                } ${isFuture ? 'opacity-20 cursor-default' : 'hover:opacity-75 active:scale-95'}`}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-gray-500 justify-center">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-600 inline-block" />Workout A</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-600 inline-block" />Workout B</span>
          <span className="text-gray-600">Tap any past day to add/edit</span>
        </div>
      </div>

      {editing && (
        <SessionEditor
          date={editing.date}
          session={editing.session}
          sessions={sessions}
          settings={settings}
          onSave={async (s) => { await upsertSession(s); setEditing(null); }}
          onDelete={async (id) => { await removeSession(id); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function SessionEditor({ date, session, sessions, settings, onSave, onDelete, onClose }) {
  const defaultType = useMemo(() => {
    if (session) return session.workoutType;
    const pastCount = sessions.filter((s) => s.date < date).length;
    return getWorkoutType(pastCount);
  }, [session, sessions, date]);

  const [workoutType, setWorkoutType] = useState(defaultType);
  const exercises = getWorkoutExercises(workoutType);

  const makeInitialState = (type) => {
    const init = {};
    for (const key of Object.keys(EXERCISES)) {
      const saved = session?.exercises?.[key];
      const { sets: total } = getSetsReps(key);
      init[key] = {
        weight: saved?.weight ?? settings.weights[key] ?? 20,
        sets:   Array.from({ length: total }, (_, i) => saved?.sets?.[i]?.completed ?? null),
      };
    }
    return init;
  };

  const [exState, setExState] = useState(() => makeInitialState(workoutType));

  const switchType = (t) => setWorkoutType(t);

  const setWeight = (key, val) =>
    setExState((s) => ({ ...s, [key]: { ...s[key], weight: val } }));

  const toggleSet = (key, i) =>
    setExState((s) => {
      const sets = [...s[key].sets];
      // cycle: null → true → false → null
      sets[i] = sets[i] === null ? true : sets[i] === true ? false : null;
      return { ...s, [key]: { ...s[key], sets } };
    });

  const handleSave = () => {
    const exercisesPayload = {};
    for (const key of exercises) {
      const { sets: total } = getSetsReps(key);
      const state = exState[key] ?? { weight: settings.weights[key] ?? 20, sets: Array(total).fill(null) };
      exercisesPayload[key] = {
        weight: state.weight,
        sets:   state.sets.map((completed) => ({ completed: completed ?? false, ts: Date.now() })),
      };
    }
    const pastCount = sessions.filter((s) => s.date < date).length;
    onSave({
      id:           makeSessionId(date),
      date,
      sessionIndex: pastCount,
      workoutType,
      exercises:    exercisesPayload,
      completed:    exercises.every((key) => {
        const { sets: total } = getSetsReps(key);
        return exercisesPayload[key].sets.filter((s) => s.completed).length === total;
      }),
    });
  };

  return (
    <div className="bg-gray-900 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg">{date}</h2>
          <p className="text-xs text-gray-500">{session ? 'Edit session' : 'Add session'}</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center">
          ×
        </button>
      </div>

      {/* Workout type toggle */}
      <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
        {['A', 'B'].map((t) => (
          <button
            key={t}
            onClick={() => switchType(t)}
            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${
              workoutType === t
                ? t === 'A' ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Workout {t}
          </button>
        ))}
      </div>

      {/* Exercises */}
      {exercises.map((key) => {
        const ex    = EXERCISES[key];
        const { sets: total } = getSetsReps(key);
        const state = exState[key] ?? { weight: settings.weights[key] ?? 20, sets: Array(total).fill(null) };

        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{ex.name}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWeight(key, Math.max(settings.barWeight ?? 20, state.weight - ex.increment))}
                  className="w-8 h-8 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
                >−</button>
                <span className="w-16 text-center font-mono font-bold text-orange-400 text-sm">
                  {state.weight}kg
                </span>
                <button
                  onClick={() => setWeight(key, state.weight + ex.increment)}
                  className="w-8 h-8 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
                >+</button>
              </div>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: total }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => toggleSet(key, i)}
                  className={`flex-1 h-11 rounded-xl font-bold text-sm transition-colors ${
                    state.sets[i] === true  ? 'bg-green-600 text-white' :
                    state.sets[i] === false ? 'bg-red-700 text-white' :
                    'bg-gray-800 text-gray-500 hover:bg-gray-700'
                  }`}
                >
                  {state.sets[i] === true ? '✓' : state.sets[i] === false ? '✗' : i + 1}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          className="flex-1 py-3 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-xl"
        >
          Save
        </button>
        {session && (
          <button
            onClick={() => { if (confirm('Delete this session?')) onDelete(session.id); }}
            className="px-5 py-3 bg-red-900/40 text-red-400 hover:bg-red-900/60 font-bold rounded-xl"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
