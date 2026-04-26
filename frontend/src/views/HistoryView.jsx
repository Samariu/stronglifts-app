import { useState, useMemo } from 'react';
import { EXERCISES, getWorkoutExercises, getSetsReps } from '../lib/program';

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function HistoryView({ sessions, settings }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedSession, setSelectedSession] = useState(null);

  const sessionsByDate = useMemo(() => {
    const map = {};
    for (const s of sessions) map[s.date] = s;
    return map;
  }, [sessions]);

  const days = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const monthStr = new Date(viewYear, viewMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const todayStr = now.toISOString().slice(0, 10);

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
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const session = sessionsByDate[dateStr];
            const isToday = dateStr === todayStr;
            const isFuture = dateStr > todayStr;

            let bg = 'bg-gray-800 text-gray-500';
            if (session?.workoutType === 'A') bg = 'bg-orange-600 text-white';
            else if (session?.workoutType === 'B') bg = 'bg-blue-600 text-white';
            else if (!isFuture && !isToday) bg = 'bg-gray-800 text-gray-600';

            return (
              <button
                key={day}
                onClick={() => session && setSelectedSession(session)}
                className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${bg} ${
                  isToday ? 'ring-2 ring-white/50' : ''
                } ${session ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div className="flex gap-4 text-xs text-gray-500 justify-center">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-600 inline-block" />Workout A</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-600 inline-block" />Workout B</span>
        </div>
      </div>

      {selectedSession && (
        <SessionDetail session={selectedSession} barWeight={settings.barWeight} onClose={() => setSelectedSession(null)} />
      )}
    </div>
  );
}

function SessionDetail({ session, barWeight, onClose }) {
  const exercises = getWorkoutExercises(session.workoutType);

  return (
    <div className="bg-gray-900 rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg">{session.date}</h2>
          <span className={`text-sm font-medium ${session.workoutType === 'A' ? 'text-orange-400' : 'text-blue-400'}`}>
            Workout {session.workoutType}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl leading-none">×</button>
      </div>

      {exercises.map((key) => {
        const ex = EXERCISES[key];
        const data = session.exercises?.[key];
        const sets = data?.sets ?? [];
        const { sets: total } = getSetsReps(key);
        const passed = sets.filter((s) => s.completed).length;

        return (
          <div key={key} className="flex items-center justify-between">
            <div>
              <div className="font-medium">{ex.name}</div>
              <div className="text-xs text-gray-500">{passed}/{total} sets</div>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: total }).map((_, i) => (
                <span
                  key={i}
                  className={`w-6 h-6 rounded text-xs flex items-center justify-center font-bold ${
                    sets[i]?.completed ? 'bg-green-700 text-green-200' :
                    sets[i]?.completed === false ? 'bg-red-800 text-red-200' :
                    'bg-gray-800 text-gray-600'
                  }`}
                >
                  {sets[i]?.completed ? '✓' : sets[i]?.completed === false ? '✗' : '·'}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
