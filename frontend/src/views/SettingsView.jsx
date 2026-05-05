import { useState } from 'react';
import { EXERCISES, ALL_PLATE_SIZES, computeNextWeight } from '../lib/program';
import { DEFAULT_SETTINGS } from '../lib/db';
import { getSyncQueueLength } from '../lib/sync';

/* eslint-disable no-undef */
const APP_VERSION = __APP_VERSION__;

// [lower, higher] options per exercise
const INCREMENT_OPTIONS = {
  deadlift: [2.5, 5.0],
  default:  [1.25, 2.5],
};

export default function SettingsView({ settings, sessions, updateSettings, needRefresh, updateServiceWorker }) {
  const [backendUrl, setBackendUrl] = useState(settings.backendUrl ?? '');
  const [saved, setSaved] = useState(false);

  const availablePlates = settings.availablePlates ?? DEFAULT_SETTINGS.availablePlates;
  const increments      = settings.increments      ?? DEFAULT_SETTINGS.increments;
  const rom             = settings.rom             ?? DEFAULT_SETTINGS.rom;

  const getIncrement = (key) => increments[key] ?? EXERCISES[key].increment;

  const currentWeight = (key) => {
    const override = settings.nextWeightOverrides?.[key];
    if (override != null) return override;
    return computeNextWeight(sessions, key, settings.weights[key] ?? 20, getIncrement(key));
  };

  const togglePlate = (plate) => {
    const next = availablePlates.includes(plate)
      ? availablePlates.filter((p) => p !== plate)
      : [...availablePlates, plate].sort((a, b) => b - a);
    if (next.length === 0) return;
    updateSettings({ availablePlates: next });
  };

  const save = async () => {
    await updateSettings({ backendUrl });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* App version + update */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-semibold text-gray-300">StrongLifts 5×5</span>
            <span className="ml-2 text-xs text-gray-600 font-mono">v{APP_VERSION}</span>
          </div>
        </div>
        {needRefresh ? (
          <button
            onClick={() => updateServiceWorker(true)}
            className="w-full py-3 rounded-xl font-semibold bg-orange-500 hover:bg-orange-400 text-white"
          >
            Reload to update
          </button>
        ) : (
          <div className="py-2.5 rounded-xl text-center text-sm text-gray-500 bg-gray-800">
            App is up to date
          </div>
        )}
      </section>

      {/* Current working weights */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-300">Current Working Weights</h2>
          <p className="text-xs text-gray-600 mt-0.5">Your next workout's working weight based on progression. Adjust to override.</p>
        </div>
        {Object.entries(EXERCISES).map(([key, ex]) => {
          const displayed = currentWeight(key);
          const inc = getIncrement(key);
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="flex-1 text-sm">{ex.name}</span>
              <button
                onClick={() => updateSettings({ nextWeightOverrides: { [key]: Math.max(settings.barWeight ?? 20, displayed - inc) } })}
                className="w-9 h-9 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
              >−</button>
              <span className="w-16 text-center font-mono font-bold text-orange-400">
                {displayed}kg
              </span>
              <button
                onClick={() => updateSettings({ nextWeightOverrides: { [key]: displayed + inc } })}
                className="w-9 h-9 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
              >+</button>
            </div>
          );
        })}
      </section>

      {/* Weight increment */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-300">Weight Increment</h2>
          <p className="text-xs text-gray-600 mt-0.5">Future workouts only — does not change history.</p>
        </div>
        {Object.entries(EXERCISES).map(([key, ex]) => {
          const options = INCREMENT_OPTIONS[key] ?? INCREMENT_OPTIONS.default;
          const current = getIncrement(key);
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="flex-1 text-sm">{ex.name}</span>
              <div className="flex bg-gray-800 rounded-lg p-0.5 gap-0.5">
                {options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => updateSettings({ increments: { [key]: opt } })}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                      current === opt
                        ? 'bg-orange-500 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    +{opt}kg
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* Available plates */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-gray-300">Available Plates</h2>
        <p className="text-xs text-gray-500">Toggle the plates your gym has. Used for warmup and plate math.</p>
        <div className="flex flex-wrap gap-2">
          {ALL_PLATE_SIZES.map((plate) => {
            const active = availablePlates.includes(plate);
            return (
              <button
                key={plate}
                onClick={() => togglePlate(plate)}
                className={`px-4 py-2 rounded-xl font-mono font-bold text-sm border-2 transition-colors ${
                  active
                    ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                    : 'bg-gray-800 border-gray-700 text-gray-600'
                }`}
              >
                {plate}kg
              </button>
            );
          })}
        </div>
      </section>

      {/* Rest timers */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-gray-300">Rest Timers</h2>
        {[
          { key: 'upper', label: 'Upper body (Bench, Row, OHP)' },
          { key: 'lower', label: 'Squat & Deadlift' },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="flex-1 text-sm text-gray-400">{label}</span>
            <button
              onClick={() => updateSettings({ restTimers: { [key]: Math.max(30, (settings.restTimers?.[key] ?? 90) - 30) } })}
              className="w-9 h-9 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
            >−</button>
            <span className="w-16 text-center font-mono font-bold">
              {Math.floor((settings.restTimers?.[key] ?? 90) / 60)}:{String((settings.restTimers?.[key] ?? 90) % 60).padStart(2, '0')}
            </span>
            <button
              onClick={() => updateSettings({ restTimers: { [key]: (settings.restTimers?.[key] ?? 90) + 30 } })}
              className="w-9 h-9 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
            >+</button>
          </div>
        ))}
      </section>

      {/* Bar weight */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-gray-300">Bar Weight</h2>
        <div className="flex items-center gap-3">
          <span className="flex-1 text-sm text-gray-400">Barbell weight</span>
          <button
            onClick={() => updateSettings({ barWeight: Math.max(10, settings.barWeight - 2.5) })}
            className="w-9 h-9 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
          >−</button>
          <span className="w-16 text-center font-mono font-bold">{settings.barWeight}kg</span>
          <button
            onClick={() => updateSettings({ barWeight: settings.barWeight + 2.5 })}
            className="w-9 h-9 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
          >+</button>
        </div>
      </section>

      {/* Range of motion */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-300">Range of Motion</h2>
          <p className="text-xs text-gray-600 mt-0.5">Used to estimate distance and energy on the Stats tab.</p>
        </div>
        {Object.entries(EXERCISES).map(([key, ex]) => {
          const val = rom[key] ?? DEFAULT_SETTINGS.rom[key] ?? 0.5;
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="flex-1 text-sm">{ex.name}</span>
              <button
                onClick={() => updateSettings({ rom: { [key]: Math.max(0.2, Math.round((val - 0.05) * 100) / 100) } })}
                className="w-9 h-9 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
              >−</button>
              <span className="w-16 text-center font-mono font-bold text-gray-300">
                {val.toFixed(2)}m
              </span>
              <button
                onClick={() => updateSettings({ rom: { [key]: Math.min(1.2, Math.round((val + 0.05) * 100) / 100) } })}
                className="w-9 h-9 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
              >+</button>
            </div>
          );
        })}
      </section>

      {/* CSV import conflict */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-gray-300">CSV Import</h2>
        <p className="text-xs text-gray-500">When importing a CSV and a session already exists for that date:</p>
        <div className="flex bg-gray-800 rounded-lg p-0.5 gap-0.5">
          {[
            { value: 'ask',  label: 'Ask each time' },
            { value: 'skip', label: 'Always skip' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => updateSettings({ csvImportConflict: value })}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                (settings.csvImportConflict ?? 'ask') === value
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Backend sync */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-gray-300">Backend Sync</h2>
        <p className="text-xs text-gray-500">
          Optional. Enter your Raspberry Pi URL. App works fully offline without this.
        </p>
        <input
          type="url"
          value={backendUrl}
          onChange={(e) => setBackendUrl(e.target.value)}
          placeholder="http://192.168.1.100:3001"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600"
        />
        <button
          onClick={save}
          className={`w-full py-3 rounded-xl font-semibold transition-colors ${
            saved ? 'bg-green-600 text-white' : 'bg-orange-500 hover:bg-orange-400 text-white'
          }`}
        >
          {saved ? 'Saved ✓' : 'Save'}
        </button>
        <div className="text-xs text-gray-600 text-center">
          {getSyncQueueLength()} item{getSyncQueueLength() !== 1 ? 's' : ''} pending sync
        </div>
      </section>

      {/* Danger zone */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-gray-300">Danger Zone</h2>
        <button
          onClick={() => {
            if (confirm('Reset setup wizard? Your workout history will be kept.')) {
              updateSettings({ setupComplete: false });
            }
          }}
          className="w-full py-3 rounded-xl font-semibold bg-gray-800 text-red-400 hover:bg-red-900/30 border border-red-900/50"
        >
          Re-run Setup Wizard
        </button>
      </section>
    </div>
  );
}
