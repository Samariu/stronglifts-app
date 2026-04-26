import { useState } from 'react';
import { DEFAULT_SETTINGS } from '../lib/db';
import { EXERCISES } from '../lib/program';

const STEPS = ['welcome', 'bar', 'weights', 'done'];

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [barWeight, setBarWeight] = useState(20);
  const [weights, setWeights] = useState({ ...DEFAULT_SETTINGS.weights });

  const handleFinish = () => {
    onComplete({ barWeight, weights });
  };

  return (
    <div className="min-h-dvh bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      {step === 0 && (
        <div className="max-w-sm w-full space-y-6 text-center">
          <div className="text-6xl">🏋️</div>
          <h1 className="text-3xl font-bold">StrongLifts 5×5</h1>
          <p className="text-gray-400">
            Progressive overload tracker. Two workouts, three days a week. Add weight every session.
          </p>
          <ul className="text-left text-sm text-gray-300 space-y-2 bg-gray-900 rounded-xl p-4">
            <li><span className="text-orange-400 font-semibold">Workout A</span> — Squat, Bench Press, Barbell Row</li>
            <li><span className="text-blue-400 font-semibold">Workout B</span> — Squat, Overhead Press, Deadlift</li>
            <li className="text-gray-500 text-xs pt-1">5 sets × 5 reps (Deadlift: 1×5)</li>
          </ul>
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
          <h2 className="text-2xl font-bold text-center">Bar Weight</h2>
          <p className="text-gray-400 text-center text-sm">Standard Olympic barbell is 20kg. Change if yours differs.</p>
          <div className="flex gap-4 justify-center">
            {[15, 20].map((w) => (
              <button
                key={w}
                onClick={() => setBarWeight(w)}
                className={`flex-1 py-4 rounded-2xl font-bold text-lg border-2 transition-colors ${
                  barWeight === w
                    ? 'border-orange-400 bg-orange-500/20 text-orange-400'
                    : 'border-gray-700 text-gray-400'
                }`}
              >
                {w}kg
              </button>
            ))}
          </div>
          <div className="flex gap-3 items-center">
            <span className="text-gray-400 text-sm">Custom:</span>
            <input
              type="number"
              value={barWeight}
              onChange={(e) => setBarWeight(Number(e.target.value))}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-lg"
              min={1} step={0.5}
            />
            <span className="text-gray-400 text-sm">kg</span>
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
          {Object.entries(EXERCISES).map(([key, ex]) => (
            <div key={key} className="bg-gray-900 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{ex.name}</span>
                <span className="text-xs text-gray-500">+{ex.increment}kg/session</span>
              </div>
              <div className="flex gap-3 items-center">
                <button
                  onClick={() => setWeights((w) => ({ ...w, [key]: Math.max(barWeight, w[key] - ex.increment) }))}
                  className="w-12 h-12 bg-gray-800 rounded-xl text-xl font-bold text-gray-300 hover:bg-gray-700"
                >−</button>
                <input
                  type="number"
                  value={weights[key]}
                  onChange={(e) => setWeights((w) => ({ ...w, [key]: Number(e.target.value) }))}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-white text-center text-lg"
                  min={barWeight} step={2.5}
                />
                <span className="text-gray-400 text-sm w-6">kg</span>
                <button
                  onClick={() => setWeights((w) => ({ ...w, [key]: w[key] + ex.increment }))}
                  className="w-12 h-12 bg-gray-800 rounded-xl text-xl font-bold text-gray-300 hover:bg-gray-700"
                >+</button>
              </div>
            </div>
          ))}
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
