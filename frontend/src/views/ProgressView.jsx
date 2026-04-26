import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { EXERCISES, getWorkoutExercises, getSetsReps, epley1RM } from '../lib/program';
import PlateCalculator from '../components/PlateCalculator';

const EXERCISE_KEYS = Object.keys(EXERCISES);

const COLORS = {
  squat:         '#f97316',
  benchPress:    '#60a5fa',
  barbellRow:    '#a78bfa',
  overheadPress: '#34d399',
  deadlift:      '#f87171',
};

export default function ProgressView({ sessions, settings }) {
  const [activeTab,       setActiveTab]       = useState('weight');
  const [selectedExercise, setSelectedExercise] = useState('squat');

  // Build per-exercise chart data from session history
  // Each session stores the actual weight used in exercises[key].weight
  const exerciseData = useMemo(() => {
    const result = {};
    for (const key of EXERCISE_KEYS) {
      result[key] = sessions
        .filter((s) => getWorkoutExercises(s.workoutType).includes(key))
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((s) => {
          const exData = s.exercises?.[key];
          const weight = exData?.weight ?? null;
          const sets   = exData?.sets ?? [];
          const { reps } = getSetsReps(key);
          const successSets = sets.filter((sv) => sv.completed).length;
          if (weight === null || successSets === 0) return null;
          return {
            date:   s.date.slice(5), // MM-DD
            weight,
            est1RM: Math.round(epley1RM(weight, reps)),
          };
        })
        .filter(Boolean);
    }
    return result;
  }, [sessions]);

  const data          = exerciseData[selectedExercise] ?? [];
  const lastEntry     = data[data.length - 1];
  const latestWeight  = lastEntry?.weight  ?? settings.weights?.[selectedExercise] ?? 20;
  const latest1RM     = lastEntry?.est1RM  ?? Math.round(epley1RM(latestWeight, 5));

  const dataKey = activeTab === '1rm' ? 'est1RM' : 'weight';

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">Progress</h1>

      {/* Tab bar */}
      <div className="flex bg-gray-900 rounded-xl p-1 gap-1">
        {[
          { id: 'weight', label: 'Weight'   },
          { id: '1rm',    label: 'Est. 1RM' },
          { id: 'plates', label: 'Plates'   },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.id
                ? 'bg-orange-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab !== 'plates' && (
        <>
          {/* Exercise selector */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {EXERCISE_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => setSelectedExercise(key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  selectedExercise === key
                    ? 'text-white border-transparent'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
                style={selectedExercise === key ? { backgroundColor: COLORS[key] } : {}}
              >
                {EXERCISES[key].name}
              </button>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-900 rounded-xl p-3 text-center">
              <div
                className="text-2xl font-bold font-mono"
                style={{ color: COLORS[selectedExercise] }}
              >
                {latestWeight}kg
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Current</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold font-mono text-purple-400">
                {latest1RM}kg
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Est. 1RM (Epley)</div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-gray-900 rounded-2xl p-4">
            {data.length < 2 ? (
              <div className="h-44 flex items-center justify-center text-gray-600 text-sm">
                Complete at least 2 sessions to see the chart
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: '#111827',
                      border: '1px solid #374151',
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: '#9ca3af' }}
                    itemStyle={{ color: COLORS[selectedExercise] }}
                    formatter={(v) => [`${v}kg`]}
                  />
                  <Line
                    type="monotone"
                    dataKey={dataKey}
                    stroke={COLORS[selectedExercise]}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: COLORS[selectedExercise] }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="text-center text-xs text-gray-600">
            {data.length} successful session
            {data.length !== 1 ? 's' : ''} — {EXERCISES[selectedExercise].name}
          </div>
        </>
      )}

      {activeTab === 'plates' && (
        <PlateCalculator barWeight={settings.barWeight} />
      )}
    </div>
  );
}
