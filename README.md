# StrongLifts App

A mobile-first, offline-first progressive web app (PWA) for logging
[StrongLifts 5×5](https://stronglifts.com/5x5/) workouts. It tracks sets, suggests
weights, calculates plates and warm-ups, and charts your progress. Everything is stored
on-device; an optional self-hosted backend can sync your data.

## Features

- Workout logging with automatic A/B rotation, rest timers and a plate calculator
- Linear progression (+increment on success, 10% deload after 3 consecutive failures),
  with a configurable "increase every N successful workouts" setting
- Programs: StrongLifts 5×5 and StrongLifts 5×5 Intermediate; optional accessory work
- kg and lb support (weights are always stored in kg)
- History, progress charts and stats
- CSV export/import and lossless JSON backup/restore
- Installable and fully usable offline; optional sync to your own backend

## Installation

### Requirements

- Node.js 20 or newer (the CI build uses Node 20) and npm

### Run the frontend (development)

```bash
git clone https://github.com/Samariu/stronglifts-app.git
cd stronglifts-app/frontend
npm install
cd ..
npm run dev
```

Vite prints the local URL. The app is served under the base path `/stronglifts-app/`
(e.g. `http://localhost:5173/stronglifts-app/`).

### Build and preview

```bash
npm run build      # output in frontend/dist/
npm run preview
```

### Optional: backend for sync

The backend is an Express 5 + SQLite (better-sqlite3) server. It also serves the built
frontend from `frontend/dist/`.

```bash
cd backend
npm install
cd ..
npm run backend    # listens on port 3001
```

Environment variables: `PORT` (default `3001`) and `DB_PATH` (default
`backend/stronglifts.db`). To enable sync, enter the server URL as `backendUrl` in the
app's Settings. Leave it empty to run without a backend.

### Tests and lint

```bash
cd frontend
npm run test       # Vitest unit tests for the pure logic in src/lib
npm run lint
```

### Deployment

Pushes to `main` build the frontend and deploy it to GitHub Pages via
`.github/workflows/deploy.yml`. `netlify.toml` is an alternative target. The base path
is set in `frontend/vite.config.js` and the PWA manifest; keep them in sync if you
change it.

## Design summary

**Stack:** React 19, Vite, Tailwind CSS v4, IndexedDB (via `idb`), Recharts. Backend:
Express 5 and better-sqlite3.

**Structure**

```
frontend/src/
  App.jsx        tab state (Today / History / Progress / Settings); no router
  views/         one component per tab, plus the first-run SetupWizard
  components/    rest timer, plate calculator, warm-up card, bottom nav
  hooks/         useSettings, useSessions: the only way data is read or written
  lib/           pure logic: program engine, program definitions, units,
                 db and migrations, backup, import/export, sync
backend/server.js  REST API and static hosting for the built frontend
```

**Key decisions**

- **Local-first data.** Settings and sessions live in IndexedDB. The two hooks wrap every
  read/write and queue changes for sync.
- **Optional, offline-first sync.** Changes are queued in `localStorage` and flushed to
  the backend when it is reachable. Conflicts are resolved last-write-wins by
  `updatedAt`.
- **Declarative programs.** Programs are data in `lib/programs.js` (workout cycle,
  exercises, sets/reps, schedule); `lib/program.js` holds pure engine functions, which
  are what the unit tests cover. There is no component/UI test coverage.
- **Progression follows what was actually logged**, not the currently selected program,
  so switching programs does not corrupt progression.
- **Weights are always stored in kg.** The kg/lb setting only affects display, input and
  hardware defaults (plates, bar, increments).
- **One session per calendar day**, with ids of the form `session-YYYY-MM-DD`.

See [`CLAUDE.md`](CLAUDE.md) for more detail on data shapes, versioning and conventions.
