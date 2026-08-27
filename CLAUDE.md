# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root unless noted.

```bash
npm run dev          # Start Vite dev server (frontend only)
npm run build        # Production build → frontend/dist/
npm run preview      # Preview the production build locally
npm run backend      # Start Express backend (port 3001)
npm run backend:dev  # Start backend with --watch
cd frontend && npm run lint  # ESLint (no root-level lint script)
cd frontend && npm run test  # Vitest (pure-function unit tests in src/lib/__tests__/)
```

Tests are Vitest unit tests covering the pure logic in `lib/program.js`,
`lib/programs.js`, `lib/units.js`, `lib/backup.js`, `lib/db.js` (migrations),
and `lib/import.js`. There is no component/UI test coverage. Run
`npm run test:watch` from `frontend/` while iterating.

## Architecture

The app is a **mobile-first PWA** (React 19 + Vite + Tailwind CSS v4) deployed to GitHub Pages at `/stronglifts-app/`. The base path is baked into `frontend/vite.config.js` and the PWA manifest — keep them in sync.

### Frontend (`frontend/src/`)

Single-page app with tab-based navigation, no router. `App.jsx` owns the tab state and passes `sessions` / `settings` as props to all views. Views are in `views/`, reusable UI in `components/`.

**Data layer** — all reads and writes go through two hooks:
- `hooks/useSettings.js` — wraps IndexedDB settings via `lib/db.js`
- `hooks/useSessions.js` — wraps IndexedDB sessions via `lib/db.js`

Both hooks call `queueSync()` after every write, which enqueues changes for the optional backend.

**Program engine** lives in `lib/program.js` (pure functions); the **program
data** lives in `lib/programs.js` (`PROGRAMS` registry + `ACCESSORIES` catalog).
Adding a program is mostly a declarative entry in `PROGRAMS`.
- Active program is `settings.program` (default `'5x5'`). Built in: **StrongLifts
  5×5** and **StrongLifts 5×5 Intermediate** (Rows 5×8, Deadlift-first 5×5,
  incline/close-grip bench variations).
- A program defines a `cycle` of workout labels (e.g. `['A','B']`), each workout's
  exercises with their `{sets, reps}`, and a `schedule.dows` for the History
  projection. The session index position in the cycle picks the workout label.
- Engine functions (`getSetsReps`, `getWorkoutType`, `getWorkoutExercises`,
  `exerciseSucceeded`, `countConsecutiveFailures`, `computeNextWeight`) accept the
  active program and fall back to classic 5×5 behavior when none is passed.
- Weight progression: +increment on success; 3 consecutive failures triggers a 10%
  deload. Progression keys off what a session **actually contains**
  (`Object.keys(session.exercises)`), so it stays correct across program switches.
- **Increase frequency**: `settings.incrementEvery[key]` (default 1) is how many
  successful workouts at a weight are needed before it goes up — 1 is classic
  linear progression, 3 holds the weight for three clean sessions first.
  `countSuccessesAtWeight` counts the streak at the last logged weight (reset by a
  failure or any weight change, deloads included) and `computeNextWeight` takes the
  frequency as its last optional parameter. Deloads are unaffected.
- **History model**: one active global program with a shared timeline; each session
  is also stamped with an (invisible) `program` tag for future per-program features.
- **Accessories** (`ACCESSORIES`): optional assistance work enabled per workout in
  Settings, stored in `session.exercises` flagged `accessory: true`, and excluded
  from progression / completion / barbell stats (`isAccessory` / `isBarbell`).
- Warmup is always exactly 5 sets × 5 reps, ramping to the working weight using only
  5 kg+ plates (no small-plate reloads); repeated ramp weights are kept as separate sets.

**Units** (`lib/units.js`): all weights are **stored in kg**, always. `settings.unit`
(`'kg' | 'lb'`) only changes the display/input edges plus the "hardware" defaults —
plate set, bar weight, increments, deload rounding step — which are themselves stored
as exact kg values (`UNIT_PROFILES`). Switching units resets the hardware settings via
`unitSwitchDefaults` but never touches history. Engine functions take the unit values
as optional parameters with kg defaults (`deload(w, step)`, `computeNextWeight(...,
roundStep)`, `getWarmupSets(..., minWarmupPlate)`, `getMinWeight(..., platePair)`,
`formatPlates(..., unit)`).

**Backup** (`lib/backup.js`): lossless JSON export/restore of settings + all sessions
(versioned format marker `stronglifts-backup`), the disaster-recovery complement to the
lossy CSV path.

**Sync** (`lib/sync.js`) is optional and offline-first: changes are queued in `localStorage`; `trySync()` flushes the queue to the backend when reachable. The frontend works fully without a backend.

### Backend (`backend/`)

Express 5 + better-sqlite3. Two tables: `sessions` and `settings`. All upserts use `updated_at`-based conflict resolution (last-write-wins). The `sessions` table has a nullable `program` column (added via a guarded, non-destructive `ALTER TABLE` on boot); the `exercises` JSON blob absorbs accessories and any per-exercise shape transparently. The backend also serves the built frontend from `frontend/dist/`.

Run it with `npm run backend` from the repo root; it listens on port 3001. Set `backendUrl` in app settings to enable sync.

### Data shapes

**Session** (stored in IndexedDB `sessions`, keyed by `id`):
```js
{
  id: 'session-YYYY-MM-DD',   // makeSessionId(date) — one per calendar day
  date: 'YYYY-MM-DD',
  sessionIndex: number,        // count of all past sessions (today excluded)
  workoutType: 'A' | 'B',     // workout label within the program's cycle; overridable in UI
  program: string,             // program id this session was logged under (default '5x5')
  exercises: {
    [exerciseKey]: {
      weight: number,          // kg
      accessory?: true,        // present for assistance work — excluded from progression/stats
      sets: [{ completed: boolean, ts: number }],
    },
  },
  completed: boolean,
  updatedAt: number,           // ms timestamp, used for backend conflict resolution
}
```

**Settings** (stored in IndexedDB `settings`, single key `'config'`). Canonical defaults live in `lib/db.js → DEFAULT_SETTINGS`:
```js
{
  program: '5x5',              // active program id (key into PROGRAMS in lib/programs.js)
  unit: 'kg',                  // display unit ('kg' | 'lb') — storage is always kg
  scheduleDows: null,          // training days 0-6 for the History projection; null = program default
  barWeight: 20,
  availablePlates: number[],   // subset of ALL_PLATE_SIZES from program.js
  weights:    { [exerciseKey]: number },  // starting weights (incl. bench variations)
  restTimers: { [exerciseKey]: number },  // seconds per exercise (legacy { upper, lower } migrated)
  increments: { [exerciseKey]: number },  // per-exercise progression step
  incrementEvery: { [exerciseKey]: number },  // successful workouts per increase; 1 = every time
  rom:        { [exerciseKey]: number },  // range of motion (m), for Stats energy/distance
  accessories: { [workoutLabel]: [{ key, sets, weight }] },  // enabled assistance work
  setupComplete: boolean,      // gates SetupWizard — false on first launch
  backendUrl: string,          // empty string disables sync
}
```

`migrateSettings` (in `lib/db.js`) idempotently backfills new fields (e.g.
`program`, `accessories`, newly added exercise keys) on load — no IndexedDB
version bump is needed since both stores are schemaless.

### First-run flow

`App.jsx` renders `<SetupWizard>` when `settings.setupComplete` is falsy. The wizard calls `updateSettings({ ...formData, setupComplete: true })` on completion, which persists to IndexedDB and dismisses the wizard.

### Other frontend modules

- `lib/export.js` — CSV export of all sessions (triggered from SettingsView)
- `views/ProgressView.jsx` — uses Recharts for weight-over-time charts

### Versioning

The version is the single source of truth in `frontend/package.json → version`. At build time, `vite.config.js` injects it as `__APP_VERSION__` (via Vite's `define`), which `SettingsView.jsx` reads and displays.

**To bump the version:** edit `frontend/package.json`, then tag the commit:
```bash
git tag v3.2.0
git push origin v3.2.0
```

Follow **semantic versioning** (`MAJOR.MINOR.PATCH`):

| Part | When to bump | Examples |
|---|---|---|
| PATCH `3.2.x` | Bug fixes, corrections, small tweaks | fix broken warmup count, typo |
| MINOR `3.x.0` | New user-visible features, enhancements | CSV import, Stats tab, new settings |
| MAJOR `x.0.0` | Architectural overhaul or breaking data changes | migrating IndexedDB schema, replacing sync |

This app has no published API or npm consumers, so semver here is purely for communicating change scope to the user — be honest about it. A release with only bug fixes is a PATCH, even if there are many of them.

### Deployment

GitHub Actions builds the frontend and deploys to GitHub Pages. The Netlify config (`netlify.toml`) is an alternative deployment target. There is no CI for the backend.
