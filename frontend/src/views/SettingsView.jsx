import { useState, useRef } from 'react';
import { EXERCISES, computeNextWeight, getMinWeight, getRestSeconds } from '../lib/program';
import { PROGRAMS, ACCESSORIES, getActiveProgram, getProgramExerciseKeys } from '../lib/programs';
import { getUnitProfile, formatWeight, formatNum, toDisplay, unitSwitchDefaults } from '../lib/units';
import { DEFAULT_SETTINGS } from '../lib/db';
import { getSyncQueueLength } from '../lib/sync';
import { exportBackupFile, parseBackup } from '../lib/backup';

/* eslint-disable no-undef */
const APP_VERSION = __APP_VERSION__;

// Successful workouts required at a weight before it goes up.
const INCREMENT_EVERY_OPTIONS = [1, 2, 3, 4];
const frequencyLabel = (n) => (n === 1 ? 'Every' : `${n}${n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`);

export default function SettingsView({ settings, sessions, updateSettings, upsertSession, needRefresh, updateServiceWorker, checkForUpdate }) {
  const [backendUrl, setBackendUrl] = useState(settings.backendUrl ?? '');
  const [saved, setSaved] = useState(false);
  const [updateCheck, setUpdateCheck] = useState('idle'); // idle | checking | done | unavailable
  const [restoreMsg, setRestoreMsg] = useState(null);
  const backupInputRef = useRef(null);

  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const { settings: restoredSettings, sessions: restoredSessions, errors } = parseBackup(await file.text());
    if (!restoredSettings && restoredSessions.length === 0) {
      setRestoreMsg(`Restore failed: ${errors[0] ?? 'no usable data'}`);
      setTimeout(() => setRestoreMsg(null), 5000);
      return;
    }
    const what = [
      restoredSessions.length > 0 ? `${restoredSessions.length} session${restoredSessions.length !== 1 ? 's' : ''}` : null,
      restoredSettings ? 'settings' : null,
    ].filter(Boolean).join(' and ');
    if (!confirm(`Restore ${what} from backup? Existing entries with the same date are overwritten.`)) return;
    for (const s of restoredSessions) await upsertSession(s);
    if (restoredSettings) await updateSettings(restoredSettings);
    setRestoreMsg(errors.length > 0 ? `Restored ${what} (${errors.length} entries skipped)` : `Restored ${what} ✓`);
    setTimeout(() => setRestoreMsg(null), 5000);
  };

  const handleCheckUpdate = async () => {
    setUpdateCheck('checking');
    const ok = await checkForUpdate();
    // Give the service worker a moment to surface a found update via needRefresh.
    setTimeout(() => setUpdateCheck(ok ? 'done' : 'unavailable'), 1500);
  };

  const availablePlates = settings.availablePlates ?? DEFAULT_SETTINGS.availablePlates;
  const increments      = settings.increments      ?? DEFAULT_SETTINGS.increments;
  const rom             = settings.rom             ?? DEFAULT_SETTINGS.rom;

  const program      = getActiveProgram(settings);
  const exerciseKeys = getProgramExerciseKeys(program);
  const unitProfile  = getUnitProfile(settings);
  const unit         = unitProfile.unit;

  const getIncrement = (key) => increments[key] ?? EXERCISES[key]?.increment ?? 2.5;
  const getIncrementEvery = (key) => settings.incrementEvery?.[key] ?? 1;

  const currentWeight = (key) => {
    const override = settings.nextWeightOverrides?.[key];
    if (override != null) return override;
    return computeNextWeight(
      sessions, key, settings.weights[key] ?? 20, getIncrement(key),
      program, unitProfile.roundStep, getIncrementEvery(key),
    );
  };

  const switchUnit = (nextUnit) => {
    if (nextUnit === unit) return;
    if (!confirm(
      `Switch to ${nextUnit}? Plates, bar weight and increments reset to standard ${nextUnit} values. ` +
      'Your history and working weights are kept and simply shown converted.'
    )) return;
    updateSettings(unitSwitchDefaults(nextUnit));
  };

  const switchProgram = (id) => {
    if (id === (settings.program ?? '5x5')) return;
    const name = PROGRAMS[id]?.name ?? id;
    if (!confirm(`Switch to ${name}? Your history is kept and working weights carry over by exercise.`)) return;
    updateSettings({ program: id });
  };

  const activeDows = settings.scheduleDows ?? program.schedule?.dows ?? [2, 4, 6];

  const toggleDow = (dow) => {
    const next = activeDows.includes(dow)
      ? activeDows.filter((d) => d !== dow)
      : [...activeDows, dow].sort((a, b) => a - b);
    if (next.length === 0) return; // always keep at least one training day
    updateSettings({ scheduleDows: next });
  };

  const accessoriesFor = (label) => settings.accessories?.[label] ?? [];

  const toggleAccessory = (label, key) => {
    const list = accessoriesFor(label);
    const next = list.some((a) => a.key === key)
      ? list.filter((a) => a.key !== key)
      : [...list, { key, sets: ACCESSORIES[key].defaultSets, weight: 0 }];
    updateSettings({ accessories: { [label]: next } });
  };

  const updateAccessory = (label, key, patch) => {
    const next = accessoriesFor(label).map((a) => (a.key === key ? { ...a, ...patch } : a));
    updateSettings({ accessories: { [label]: next } });
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
          <span className="font-semibold text-gray-300">{program.name}</span>
          <span className="text-xs text-gray-600 font-mono">v{APP_VERSION}</span>
        </div>
        {needRefresh ? (
          <button
            onClick={() => updateServiceWorker(true)}
            className="w-full py-3 rounded-xl font-semibold bg-orange-500 hover:bg-orange-400 text-white"
          >
            Reload to update
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={handleCheckUpdate}
              disabled={updateCheck === 'checking'}
              className="flex-1 py-2.5 rounded-xl font-semibold bg-gray-800 hover:bg-gray-700 text-white disabled:opacity-60"
            >
              Check for updates
            </button>
            <span className="text-sm text-gray-500 shrink-0">
              {updateCheck === 'checking'    ? 'Checking…'
                : updateCheck === 'done'        ? 'Up to date'
                : updateCheck === 'unavailable' ? 'Unavailable'
                : 'Tap to check'}
            </span>
          </div>
        )}
      </section>

      {/* Program */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-300">Program</h2>
          <p className="text-xs text-gray-600 mt-0.5">Switching keeps your history; working weights carry over by exercise.</p>
        </div>
        <div className="space-y-2">
          {Object.values(PROGRAMS).map((p) => {
            const active = p.id === program.id;
            return (
              <button
                key={p.id}
                onClick={() => switchProgram(p.id)}
                className={`w-full text-left rounded-xl p-3 border-2 transition-colors ${
                  active
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-gray-800 bg-gray-800/40 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-semibold text-sm ${active ? 'text-orange-400' : 'text-gray-200'}`}>{p.name}</span>
                  {active && <span className="text-xs text-orange-400">Active</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Units */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-300">Units</h2>
          <p className="text-xs text-gray-600 mt-0.5">Switching converts the display; your logged history stays intact.</p>
        </div>
        <div className="flex bg-gray-800 rounded-lg p-0.5 gap-0.5">
          {['kg', 'lb'].map((u) => (
            <button
              key={u}
              onClick={() => switchUnit(u)}
              className={`flex-1 py-2 rounded-md text-sm font-bold transition-colors ${
                unit === u ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </section>

      {/* Schedule */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-300">Training Days</h2>
          <p className="text-xs text-gray-600 mt-0.5">Days shown as planned workouts on the History calendar.</p>
        </div>
        <div className="flex gap-1.5">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((label, dow) => {
            const active = activeDows.includes(dow);
            return (
              <button
                key={dow}
                onClick={() => toggleDow(dow)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border-2 transition-colors ${
                  active
                    ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                    : 'bg-gray-800 border-gray-700 text-gray-600'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {settings.scheduleDows != null && (
          <button
            onClick={() => updateSettings({ scheduleDows: null })}
            className="w-full py-2 rounded-xl text-xs font-medium text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            Reset to program default
          </button>
        )}
      </section>

      {/* Current working weights */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-300">Current Working Weights</h2>
          <p className="text-xs text-gray-600 mt-0.5">Your next workout's working weight based on progression. Adjust to override.</p>
        </div>
        {exerciseKeys.map((key) => {
          const ex = EXERCISES[key];
          const displayed = currentWeight(key);
          const inc = getIncrement(key);
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="flex-1 text-sm">{ex.name}</span>
              <button
                onClick={() => updateSettings({ nextWeightOverrides: { [key]: Math.max(getMinWeight(key, settings.barWeight ?? 20, unitProfile.minPlatePair), displayed - inc) } })}
                className="w-9 h-9 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
              >−</button>
              <span className="w-16 text-center font-mono font-bold text-orange-400">
                {formatWeight(displayed, unit)}
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
        {exerciseKeys.map((key) => {
          const ex = EXERCISES[key];
          const options = unitProfile.incrementOptions[key === 'deadlift' ? 'deadlift' : 'default'];
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
                    +{formatNum(toDisplay(opt, unit))}{unit}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* Increase frequency */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-300">Increase Frequency</h2>
          <p className="text-xs text-gray-600 mt-0.5">
            How many successful workouts at a weight before it goes up. Slow this down when
            adding weight every session stops working.
          </p>
        </div>
        {exerciseKeys.map((key) => {
          const ex      = EXERCISES[key];
          const current = getIncrementEvery(key);
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="flex-1 text-sm">{ex.name}</span>
              <div className="flex bg-gray-800 rounded-lg p-0.5 gap-0.5">
                {INCREMENT_EVERY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => updateSettings({ incrementEvery: { [key]: opt } })}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                      current === opt
                        ? 'bg-orange-500 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {frequencyLabel(opt)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <p className="text-xs text-gray-600">
          Failures are unaffected: three in a row still deloads by 10%.
        </p>
      </section>

      {/* Available plates */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-gray-300">Available Plates</h2>
        <p className="text-xs text-gray-500">Toggle the plates your gym has. Used for warmup and plate math.</p>
        <div className="flex flex-wrap gap-2">
          {unitProfile.plates.map((plate) => {
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
                {formatNum(toDisplay(plate, unit))}{unit}
              </button>
            );
          })}
        </div>
      </section>

      {/* Rest timers */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-300">Rest Timers</h2>
          <p className="text-xs text-gray-600 mt-0.5">Rest between sets, per exercise.</p>
        </div>
        {exerciseKeys.map((key) => {
          const ex = EXERCISES[key];
          const secs = getRestSeconds(settings.restTimers, key);
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="flex-1 text-sm text-gray-400">{ex.name}</span>
              <button
                onClick={() => updateSettings({ restTimers: { [key]: Math.max(30, secs - 30) } })}
                className="w-9 h-9 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
              >−</button>
              <span className="w-16 text-center font-mono font-bold">
                {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
              </span>
              <button
                onClick={() => updateSettings({ restTimers: { [key]: secs + 30 } })}
                className="w-9 h-9 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
              >+</button>
            </div>
          );
        })}
      </section>

      {/* Bar weight */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-gray-300">Bar Weight</h2>
        <div className="flex items-center gap-3">
          <span className="flex-1 text-sm text-gray-400">Barbell weight</span>
          <button
            onClick={() => updateSettings({ barWeight: Math.max(unitProfile.barStep, settings.barWeight - unitProfile.barStep) })}
            className="w-9 h-9 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
          >−</button>
          <span className="w-16 text-center font-mono font-bold">{formatWeight(settings.barWeight, unit)}</span>
          <button
            onClick={() => updateSettings({ barWeight: settings.barWeight + unitProfile.barStep })}
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
        {exerciseKeys.map((key) => {
          const ex = EXERCISES[key];
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

      {/* Assistance work */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-300">Assistance Work</h2>
          <p className="text-xs text-gray-600 mt-0.5">Optional accessories per workout. They don't affect progression or count toward completion.</p>
        </div>
        {program.cycle.map((label) => {
          const list = accessoriesFor(label);
          const enabled = new Set(list.map((a) => a.key));
          return (
            <div key={label} className="space-y-2">
              <div className="text-sm font-medium text-gray-400">{program.workouts[label].name}</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ACCESSORIES).map(([key, acc]) => (
                  <button
                    key={key}
                    onClick={() => toggleAccessory(label, key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      enabled.has(key)
                        ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                        : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {acc.name}
                  </button>
                ))}
              </div>
              {list.map((a) => {
                const acc = ACCESSORIES[a.key];
                return (
                  <div key={a.key} className="flex items-center gap-2 pl-1">
                    <span className="flex-1 text-sm text-gray-300">{acc.name}</span>
                    <button
                      onClick={() => updateAccessory(label, a.key, { sets: Math.max(1, a.sets - 1) })}
                      className="w-8 h-8 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
                    >−</button>
                    <span className="w-14 text-center text-xs font-mono text-gray-300">{a.sets}×{acc.unit}</span>
                    <button
                      onClick={() => updateAccessory(label, a.key, { sets: a.sets + 1 })}
                      className="w-8 h-8 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
                    >+</button>
                    {acc.unit === 'kg' && (
                      <>
                        <button
                          onClick={() => updateAccessory(label, a.key, { weight: Math.max(0, (a.weight ?? 0) - unitProfile.roundStep) })}
                          className="w-8 h-8 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
                        >−</button>
                        <span className="w-12 text-center text-xs font-mono text-orange-400">{formatWeight(a.weight ?? 0, unit)}</span>
                        <button
                          onClick={() => updateAccessory(label, a.key, { weight: (a.weight ?? 0) + unitProfile.roundStep })}
                          className="w-8 h-8 bg-gray-800 rounded-lg font-bold hover:bg-gray-700"
                        >+</button>
                      </>
                    )}
                  </div>
                );
              })}
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

      {/* Backup & restore */}
      <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-gray-300">Backup &amp; Restore</h2>
        <p className="text-xs text-gray-500">
          Full JSON backup of your settings and complete workout history. Unlike CSV, this restores everything exactly.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => exportBackupFile(sessions, settings)}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            Export backup
          </button>
          <button
            onClick={() => backupInputRef.current?.click()}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            Restore backup
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleRestore}
          />
        </div>
        {restoreMsg && (
          <div className="text-center text-sm text-green-400 bg-green-900/20 rounded-xl py-2 px-3">
            {restoreMsg}
          </div>
        )}
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
