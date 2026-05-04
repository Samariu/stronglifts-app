import { useState, useMemo, useRef } from 'react';
import {
  EXERCISES, getWorkoutExercises, getWorkoutType, getSetsReps,
} from '../lib/program';
import { makeSessionId } from '../lib/db';
import { exportSessionsCSV } from '../lib/export';
import { importSessionsCSV } from '../lib/import';

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfMonth(year, month) { return new Date(year, month, 1).getDay(); }

export default function HistoryView({ sessions, settings, upsertSession, removeSession }) {
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [editing,   setEditing]   = useState(null);
  const [importMsg, setImportMsg] = useState(null);
  const [conflictQueue, setConflictQueue] = useState(null);
  const fileInputRef = useRef(null);

  const sessionsByDate = useMemo(() => {
    const map = {};
    for (const s of sessions) map[s.date] = s;
    return map;
  }, [sessions]);

  const todayStr = now.toISOString().slice(0, 10);

  // Project future workout days: every other day from last session, alternating A/B, 90 days out
  const futureSessions = useMemo(() => {
    const map = {};
    if (sessions.length === 0) return map;
    const last = sessions[sessions.length - 1]; // sorted by date in useSessions
    let type = last.workoutType === 'A' ? 'B' : 'A';
    const d = new Date(last.date);
    for (let i = 0; i < 45; i++) { // 45 iterations × 2 days = 90 days
      d.setDate(d.getDate() + 2);
      const ds = d.toISOString().slice(0, 10);
      if (ds <= todayStr) { type = type === 'A' ? 'B' : 'A'; continue; }
      map[ds] = type;
      type = type === 'A' ? 'B' : 'A';
    }
    return map;
  }, [sessions, todayStr]);

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

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const text = await file.text();
    const { toImport, errors } = importSessionsCSV(text);
    if (errors.length > 0) {
      setImportMsg(`Import errors: ${errors.slice(0, 3).join('; ')}`);
      setTimeout(() => setImportMsg(null), 5000);
      return;
    }

    const conflicts = toImport.filter((s) => sessionsByDate[s.date]);
    const clean     = toImport.filter((s) => !sessionsByDate[s.date]);

    for (const s of clean) {
      const pastCount = sessions.filter((ex) => ex.date < s.date).length;
      await upsertSession({ ...s, sessionIndex: pastCount });
    }

    if (conflicts.length === 0) {
      setImportMsg(`Imported ${clean.length} session${clean.length !== 1 ? 's' : ''}`);
      setTimeout(() => setImportMsg(null), 4000);
      return;
    }

    const conflictSetting = settings.csvImportConflict ?? 'ask';
    if (conflictSetting === 'skip') {
      setImportMsg(`Imported ${clean.length} session${clean.length !== 1 ? 's' : ''}, skipped ${conflicts.length} conflicts`);
      setTimeout(() => setImportMsg(null), 4000);
      return;
    }

    // Ask mode: queue conflicts for user resolution
    setConflictQueue({ pending: conflicts, imported: clean.length, skipped: 0 });
  };

  const resolveConflict = async (action) => {
    if (!conflictQueue) return;
    const { pending, imported, skipped } = conflictQueue;
    const [current, ...rest] = pending;

    if (action === 'overwrite') {
      const pastCount = sessions.filter((ex) => ex.date < current.date).length;
      await upsertSession({ ...current, sessionIndex: pastCount });
    }
    if (action === 'skip-all') {
      setImportMsg(`Imported ${imported} session${imported !== 1 ? 's' : ''}, skipped ${pending.length + skipped} conflicts`);
      setTimeout(() => setImportMsg(null), 4000);
      setConflictQueue(null);
      return;
    }

    const newSkipped = action === 'skip' ? skipped + 1 : skipped;
    const newImported = action === 'overwrite' ? imported + 1 : imported;

    if (rest.length === 0) {
      setImportMsg(`Imported ${newImported} session${newImported !== 1 ? 's' : ''}, skipped ${newSkipped} conflicts`);
      setTimeout(() => setImportMsg(null), 4000);
      setConflictQueue(null);
    } else {
      setConflictQueue({ pending: rest, imported: newImported, skipped: newSkipped });
    }
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
            const projected = futureSessions[dateStr];

            let bg = 'bg-gray-800 text-gray-600';
            if (session?.workoutType === 'A')      bg = 'bg-orange-600 text-white';
            else if (session?.workoutType === 'B') bg = 'bg-blue-600 text-white';
            else if (projected === 'A')            bg = 'bg-orange-900/50 text-orange-600';
            else if (projected === 'B')            bg = 'bg-blue-900/50 text-blue-600';

            return (
              <button
                key={day}
                onClick={() => openEditor(dateStr)}
                disabled={isFuture}
                className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${bg} ${
                  isToday ? 'ring-2 ring-white/50' : ''
                } ${isFuture ? 'cursor-default' : 'hover:opacity-75 active:scale-95'}`}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-gray-500 justify-center">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-600 inline-block" />Workout A</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-600 inline-block" />Workout B</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-900/60 border border-orange-800 inline-block" />Projected A</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-900/60 border border-blue-800 inline-block" />Projected B</span>
        </div>

        <div className="flex gap-2">
          {sessions.length > 0 && (
            <button
              onClick={() => exportSessionsCSV(sessions)}
              className="flex-1 py-2 rounded-xl text-sm font-medium text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              Export CSV
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-2 rounded-xl text-sm font-medium text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImport}
          />
        </div>

        {importMsg && (
          <div className="text-center text-sm text-green-400 bg-green-900/20 rounded-xl py-2 px-3">
            {importMsg}
          </div>
        )}
      </div>

      {/* Conflict resolution modal */}
      {conflictQueue && (
        <div className="bg-gray-900 rounded-2xl p-4 space-y-3 border border-yellow-900/50">
          <h3 className="font-semibold text-yellow-400">Import Conflict</h3>
          <p className="text-sm text-gray-400">
            A session already exists for <span className="text-white font-mono">{conflictQueue.pending[0].date}</span>.
            What should happen? ({conflictQueue.pending.length} remaining)
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => resolveConflict('skip')}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700"
            >
              Skip
            </button>
            <button
              onClick={() => resolveConflict('overwrite')}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
            >
              Overwrite
            </button>
            <button
              onClick={() => resolveConflict('skip-all')}
              className="w-full py-2.5 rounded-xl text-sm font-medium bg-gray-800 text-gray-500 hover:bg-gray-700"
            >
              Skip all remaining conflicts
            </button>
          </div>
        </div>
      )}

      {editing && (
        <SessionEditor
          key={editing.date}
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

  const getIncrement = (key) => settings.increments?.[key] ?? EXERCISES[key].increment;

  const makeInitialState = () => {
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

  const [exState, setExState] = useState(() => makeInitialState());

  const setWeight = (key, val) =>
    setExState((s) => ({ ...s, [key]: { ...s[key], weight: val } }));

  const toggleSet = (key, i) =>
    setExState((s) => {
      const sets = [...s[key].sets];
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg">{date}</h2>
          <p className="text-xs text-gray-500">{session ? 'Edit session' : 'Add session'}</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center">
          ×
        </button>
      </div>

      <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
        {['A', 'B'].map((t) => (
          <button
            key={t}
            onClick={() => setWorkoutType(t)}
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

      {exercises.map((key) => {
        const ex    = EXERCISES[key];
        const { sets: total } = getSetsReps(key);
        const state = exState[key] ?? { weight: settings.weights[key] ?? 20, sets: Array(total).fill(null) };
        const inc   = getIncrement(key);

        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{ex.name}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWeight(key, Math.max(settings.barWeight ?? 20, state.weight - inc))}
                  className="w-8 h-8 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
                >−</button>
                <span className="w-16 text-center font-mono font-bold text-orange-400 text-sm">
                  {state.weight}kg
                </span>
                <button
                  onClick={() => setWeight(key, state.weight + inc)}
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
