import { useState } from 'react';
import { EXERCISES, ALL_PLATE_SIZES } from '../lib/program';
import { DEFAULT_SETTINGS } from '../lib/db';
import { getSyncQueueLength } from '../lib/sync';

export default function SettingsView({ settings, updateSettings }) {
  const [backendUrl, setBackendUrl] = useState(settings.backendUrl ?? '');
  const [saved, setSaved] = useState(false);

  const availablePlates = settings.availablePlates ?? DEFAULT_SETTINGS.availablePlates;

  const togglePlate = (plate) => {
    const next = availablePlates.includes(plate)
      ? availablePlates.filter((p) => p !== plate)
      : [...availablePlates, plate].sort((a, b) => b - a);
    if (next.length === 0) return; // always keep at least one plate
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

      {/* Working weights */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-gray-300">Working Weights</h2>
        {Object.entries(EXERCISES).map(([key, ex]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="flex-1 text-sm">{ex.name}</span>
            <button
              onClick={() => updateSettings({ weights: { [key]: Math.max(settings.barWeight, (settings.weights[key] ?? 20) - ex.increment) } })}
              className="w-9 h-9 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
            >−</button>
            <span className="w-16 text-center font-mono font-bold text-orange-400">
              {settings.weights[key] ?? 20}kg
            </span>
            <button
              onClick={() => updateSettings({ weights: { [key]: (settings.weights[key] ?? 20) + ex.increment } })}
              className="w-9 h-9 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
            >+</button>
          </div>
        ))}
      </section>

      {/* Available plates */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-gray-300">Available Plates</h2>
        <p className="text-xs text-gray-500">Toggle the plates your gym has. Used for warmup calculation and plate math.</p>
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

      <div className="text-center text-xs text-gray-700 pb-4">
        StrongLifts 5×5 Tracker — offline-first PWA
      </div>
    </div>
  );
}
