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
```

There are no tests.

## Architecture

The app is a **mobile-first PWA** (React 19 + Vite + Tailwind CSS v4) deployed to GitHub Pages at `/stronglifts-app/`. The base path is baked into `frontend/vite.config.js` and the PWA manifest — keep them in sync.

### Frontend (`frontend/src/`)

Single-page app with tab-based navigation, no router. `App.jsx` owns the tab state and passes `sessions` / `settings` as props to all views. Views are in `views/`, reusable UI in `components/`.

**Data layer** — all reads and writes go through two hooks:
- `hooks/useSettings.js` — wraps IndexedDB settings via `lib/db.js`
- `hooks/useSessions.js` — wraps IndexedDB sessions via `lib/db.js`

Both hooks call `queueSync()` after every write, which enqueues changes for the optional backend.

**Program logic** lives entirely in `lib/program.js`:
- Workout A: Squat / Bench Press / Barbell Row
- Workout B: Squat / Overhead Press / Deadlift
- Session index parity determines A/B alternation
- Weight progression: +2.5 kg on success; 3 consecutive failures triggers a 10% deload
- Deadlift is always 1×5; all other lifts are 5×5
- Warmup sets are plate-stack-optimized, always exactly 5 sets

**Sync** (`lib/sync.js`) is optional and offline-first: changes are queued in `localStorage`; `trySync()` flushes the queue to the backend when reachable. The frontend works fully without a backend.

### Backend (`backend/`)

Express 5 + better-sqlite3. Two tables: `sessions` and `settings`. All upserts use `updated_at`-based conflict resolution (last-write-wins). The backend also serves the built frontend from `frontend/dist/`.

Run it with `npm run backend` from the repo root; it listens on port 3001. Set `backendUrl` in app settings to enable sync.

### Data shapes

**Session** (stored in IndexedDB `sessions`, keyed by `id`):
```js
{
  id: 'session-YYYY-MM-DD',   // makeSessionId(date) — one per calendar day
  date: 'YYYY-MM-DD',
  sessionIndex: number,        // count of all past sessions (today excluded)
  workoutType: 'A' | 'B',     // derived from sessionIndex parity; can be overridden in UI
  exercises: {
    [exerciseKey]: {
      weight: number,          // kg
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
  barWeight: 20,
  availablePlates: number[],   // subset of ALL_PLATE_SIZES from program.js
  weights: { squat, benchPress, barbellRow, overheadPress, deadlift },  // starting weights
  restTimers: { upper: 90, lower: 180 },  // seconds; upper = bench/row/OHP, lower = squat/deadlift
  setupComplete: boolean,      // gates SetupWizard — false on first launch
  backendUrl: string,          // empty string disables sync
}
```

### First-run flow

`App.jsx` renders `<SetupWizard>` when `settings.setupComplete` is falsy. The wizard calls `updateSettings({ ...formData, setupComplete: true })` on completion, which persists to IndexedDB and dismisses the wizard.

### Other frontend modules

- `lib/export.js` — CSV export of all sessions (triggered from SettingsView)
- `views/ProgressView.jsx` — uses Recharts for weight-over-time charts

### Deployment

GitHub Actions builds the frontend and deploys to GitHub Pages. The Netlify config (`netlify.toml`) is an alternative deployment target. There is no CI for the backend.
