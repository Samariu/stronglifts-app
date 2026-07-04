import { useState } from 'react';
import { DEFAULT_SETTINGS } from '../lib/db';
import { EXERCISES, getMinWeight } from '../lib/program';
import { PROGRAMS, getProgram, getProgramExerciseKeys } from '../lib/programs';
import {
  UNIT_PROFILES, formatWeight, formatNum, toDisplay, fromDisplay, unitSwitchDefaults,
} from '../lib/units';

// Sensible starting weights for a unit system: the empty bar, or bar + one
// plate per side where the lift needs it (Row/Deadlift).
const defaultWeightsFor = (unit) => {
  const p = UNIT_PROFILES[unit];
  return Object.fromEntries(
    Object.keys(DEFAULT_SETTINGS.weights).map((key) => [
      key,
      getMinWeight(key, p.defaultBar, p.minPlatePair),
    ]),
  );
};

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [programId, setProgramId] = useState('5x5');
  const [unit, setUnit] = useState('kg');
  const [barWeight, setBarWeight] = useState(20);
  const [weights, setWeights] = useState({ ...DEFAULT_SETTINGS.weights });

  const program = getProgram(programId);
  const exerciseKeys = getProgramExerciseKeys(program);
  const profile = UNIT_PROFILES[unit];

  const incFor = (key) =>
    profile.incrementOptions[key === 'deadlift' ? 'deadlift' : 'default'][1];

  const switchUnit = (u) => {
    if (u === unit) return;
    setUnit(u);
    setBarWeight(UNIT_PROFILES[u].defaultBar);
    setWeights(defaultWeightsFor(u));
  };

  const handleFinish = () => {
    onComplete({ ...unitSwitchDefaults(unit), barWeight, weights, program: programId });
  };

  return (
    <div className="min-h-dvh bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      {step === 0 && (
        <div className="max-w-sm w-full space-y-6 text-center">
          <div className="text-6xl">🏋️</div>
          <h1 className="text-3xl font-bold">StrongLifts</h1>
          <p className="text-gray-400">
            Progressive overload tracker. Pick a program to get started.
          </p>
          <div className="space-y-2 text-left">
            {Object.values(PROGRAMS).map((p) => {
              const active = p.id === programId;
              return (
                <button
                  key={p.id}
                  onClick={() => setProgramId(p.id)}
                  className={`w-full rounded-xl p-4 border-2 transition-colors ${
                    active
                      ? 'border-orange-400 bg-orange-500/10'
                      : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${active ? 'text-orange-400' : 'text-gray-200'}`}>{p.name}</span>
                    {active && <span className="text-orange-400 text-lg leading-none">✓</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{p.description}</p>
                  <div className="text-xs text-gray-400 mt-2 space-y-0.5">
                    {p.cycle.map((label) => (
                      <div key={label}>
                        <span className="text-gray-300 font-medium">{p.workouts[label].name}</span>
                        {' — '}
                        {p.workouts[label].exercises.map((e) => EXERCISES[e.key]?.name ?? e.key).join(', ')}
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setStep(1)}
            className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-4 rounded-2xl text-lg transition-colors"
          >
            Get Started
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="max-w-sm w-full space-y-6">
          <h2 className="text-2xl font-bold text-center">Units &amp; Bar</h2>
          <div className="flex bg-gray-900 rounded-xl p-1 gap-1">
            {['kg', 'lb'].map((u) => (
              <button
                key={u}
                onClick={() => switchUnit(u)}
                className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors ${
                  unit === u ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
          <p className="text-gray-400 text-center text-sm">
            Standard Olympic barbell is {unit === 'lb' ? '45lb' : '20kg'}. Change if yours differs.
          </p>
          <div className="flex gap-4 justify-center">
            {profile.barOptions.map((w) => (
              <button
                key={w}
                onClick={() => setBarWeight(w)}
                className={`flex-1 py-4 rounded-2xl font-bold text-lg border-2 transition-colors ${
                  barWeight === w
                    ? 'border-orange-400 bg-orange-500/20 text-orange-400'
                    : 'border-gray-700 text-gray-400'
                }`}
              >
                {formatWeight(w, unit)}
              </button>
            ))}
          </div>
          <div className="flex gap-3 items-center">
            <span className="text-gray-400 text-sm">Custom:</span>
            <input
              type="number"
              value={formatNum(toDisplay(barWeight, unit))}
              onChange={(e) => setBarWeight(fromDisplay(Number(e.target.value), unit))}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-lg"
              min={1} step={unit === 'lb' ? 1 : 0.5}
            />
            <span className="text-gray-400 text-sm">{unit}</span>
          </div>
          <button
            onClick={() => setStep(2)}
            className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-4 rounded-2xl text-lg transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-sm w-full space-y-5">
          <h2 className="text-2xl font-bold text-center">Starting Weights</h2>
          <p className="text-gray-400 text-center text-sm">
            Beginners: start light — the bar or just above. You'll progress fast.
          </p>
          {exerciseKeys.map((key) => {
            const ex = EXERCISES[key];
            const inc = incFor(key);
            const min = getMinWeight(key, barWeight, profile.minPlatePair);
            return (
            <div key={key} className="bg-gray-900 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{ex.name}</span>
                <span className="text-xs text-gray-500">+{formatNum(toDisplay(inc, unit))}{unit}/session</span>
              </div>
              <div className="flex gap-3 items-center">
                <button
                  onClick={() => setWeights((w) => ({ ...w, [key]: Math.max(min, w[key] - inc) }))}
                  className="w-12 h-12 bg-gray-800 rounded-xl text-xl font-bold text-gray-300 hover:bg-gray-700"
                >−</button>
                <input
                  type="number"
                  value={formatNum(toDisplay(weights[key], unit))}
                  onChange={(e) => setWeights((w) => ({ ...w, [key]: fromDisplay(Number(e.target.value), unit) }))}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-white text-center text-lg"
                  min={formatNum(toDisplay(min, unit))} step={unit === 'lb' ? 5 : 2.5}
                />
                <span className="text-gray-400 text-sm w-6">{unit}</span>
                <button
                  onClick={() => setWeights((w) => ({ ...w, [key]: w[key] + inc }))}
                  className="w-12 h-12 bg-gray-800 rounded-xl text-xl font-bold text-gray-300 hover:bg-gray-700"
                >+</button>
              </div>
            </div>
            );
          })}
          <button
            onClick={handleFinish}
            className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-4 rounded-2xl text-lg transition-colors mt-2"
          >
            Start Training 💪
          </button>
        </div>
      )}
    </div>
  );
}
