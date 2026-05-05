import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { EXERCISES, getWorkoutExercises, getSetsReps, epley1RM, getWarmupSets } from '../lib/program';
import { DEFAULT_SETTINGS } from '../lib/db';
import PlateCalculator from '../components/PlateCalculator';

const EXERCISE_KEYS = Object.keys(EXERCISES);

const COLORS = {
  squat:         '#f97316',
  benchPress:    '#60a5fa',
  barbellRow:    '#a78bfa',
  overheadPress: '#34d399',
  deadlift:      '#f87171',
};

// Energy comparison templates. Each gets totalJoules as input and returns a string.
const ENERGY_COMPARISONS = [
  (j) => `charged your phone ${(j / 37800).toFixed(1)} times`,
  (j) => `boiled ${(j / 83680).toFixed(1)} cups of water`,
  (j) => `powered a 100 W bulb for ${Math.round(j / 100)} seconds`,
  (j) => `launched ${Math.round(j / 140)} tennis balls at 250 km/h`,
  (j) => `${(j / 14715).toFixed(2)}× lifting a car 1 metre`,
  (j) => `powered a laptop for ${Math.round(j / 65)} seconds`,
  (j) => `${Math.round(j / 156)} mosquitoes launched to escape velocity`,
  (j) => `${(j / 3200).toFixed(1)} professional boxer punches`,
  (j) => `lifted the Eiffel Tower ${(j / (7300000 * 9.81)).toFixed(5)} metres`,
  (j) => `moved a 70 kg person ${(j / (70 * 9.81)).toFixed(1)} metres upward`,
  (j) => `${(j / 4184000).toFixed(4)} kg of TNT equivalent`,
  (j) => `${((j / 8.4e13) * 100).toFixed(8)}% of a nuclear bomb`,
];

function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatEnergy(joules) {
  if (joules >= 1_000_000) return `${(joules / 1_000_000).toFixed(2)} MJ`;
  if (joules >= 1_000)     return `${(joules / 1_000).toFixed(1)} kJ`;
  return `${Math.round(joules)} J`;
}

function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

export default function ProgressView({ sessions, settings }) {
  const [activeTab,        setActiveTab]        = useState('weight');
  const [selectedExercise, setSelectedExercise] = useState('squat');

  const rom = settings.rom ?? DEFAULT_SETTINGS.rom;

  // Per-exercise chart data
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
            date:   s.date.slice(5),
            weight,
            est1RM: Math.round(epley1RM(weight, reps)),
          };
        })
        .filter(Boolean);
    }
    return result;
  }, [sessions]);

  // Totals: kg moved, distance, energy per exercise (working sets + 5 assumed warmup sets)
  const totals = useMemo(() => {
    const barWeight      = settings.barWeight ?? 20;
    const availablePlates = settings.availablePlates ?? [];
    const result = {};
    let totalJoules = 0;
    for (const key of EXERCISE_KEYS) {
      let kgMoved = 0;
      let distM   = 0;
      const romM          = rom[key] ?? 0.5;
      const includeBarSets = key !== 'deadlift' && key !== 'barbellRow';
      for (const s of sessions) {
        const exData = s.exercises?.[key];
        if (!exData) continue;
        const { reps } = getSetsReps(key);
        const completedSets = (exData.sets ?? []).filter((sv) => sv.completed).length;
        const weight = exData.weight ?? 0;
        if (completedSets === 0) continue;
        // Working sets
        kgMoved += weight * completedSets * reps;
        distM   += completedSets * reps * romM;
        totalJoules += weight * 9.81 * romM * completedSets * reps;
        // Warmup sets (5 assumed, using current plate settings)
        const warmupSets = getWarmupSets(weight, barWeight, availablePlates, includeBarSets);
        for (const ws of warmupSets) {
          kgMoved += ws.weight * ws.reps;
          distM   += ws.reps * romM;
          totalJoules += ws.weight * 9.81 * romM * ws.reps;
        }
      }
      result[key] = { kgMoved: Math.round(kgMoved), distM };
    }
    result._totalJoules = totalJoules;
    return result;
  }, [sessions, rom, settings.barWeight, settings.availablePlates]);

  // Pick 3 energy comparisons, seeded by today's date so they change daily
  const comparisons = useMemo(() => {
    const seed = parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ''), 10);
    return seededShuffle(ENERGY_COMPARISONS, seed).slice(0, 3);
  }, []);

  const data         = exerciseData[selectedExercise] ?? [];
  const lastEntry    = data[data.length - 1];
  const latestWeight = lastEntry?.weight  ?? settings.weights?.[selectedExercise] ?? 20;
  const latest1RM    = lastEntry?.est1RM  ?? Math.round(epley1RM(latestWeight, 5));
  const dataKey      = activeTab === '1rm' ? 'est1RM' : 'weight';
  const totalJoules  = totals._totalJoules;

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">Stats</h1>

      {/* Energy totals card */}
      {sessions.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
          <h2 className="font-semibold text-gray-300">All-Time Totals</h2>
          <div className="space-y-2">
            {EXERCISE_KEYS.map((key) => {
              const { kgMoved, distM } = totals[key] ?? {};
              if (!kgMoved) return null;
              return (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{EXERCISES[key].name}</span>
                  <div className="flex gap-3 text-right">
                    <span className="font-mono text-white">{kgMoved.toLocaleString()} kg</span>
                    <span className="font-mono text-gray-500">{formatDistance(distM)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-gray-800 pt-3 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Total energy</span>
              <span className="font-mono font-bold text-orange-400">{formatEnergy(totalJoules)}</span>
            </div>
            {totalJoules > 0 && comparisons.map((fn, i) => (
              <div key={i} className="text-xs text-gray-600 text-right">
                ≈ {fn(totalJoules)}
              </div>
            ))}
          </div>
        </div>
      )}

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
        <PlateCalculator barWeight={settings.barWeight} availablePlates={settings.availablePlates} />
      )}
    </div>
  );
}
