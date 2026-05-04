import { EXERCISES, getSetsReps } from './program';
import { makeSessionId } from './db';

// Build a reverse map: exercise name → key
const NAME_TO_KEY = Object.fromEntries(
  Object.entries(EXERCISES).map(([key, ex]) => [ex.name.toLowerCase(), key])
);

function parseCSV(text) {
  const rows = [];
  const lines = text.trim().split(/\r?\n/);
  for (const line of lines) {
    const cols = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        cols.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

export const importSessionsCSV = (text) => {
  const errors = [];
  const rows = parseCSV(text);
  if (rows.length < 2) return { toImport: [], errors: ['No data rows found'] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);

  const iDate          = idx('date');
  const iWorkoutType   = idx('workout_type');
  const iExercise      = idx('exercise');
  const iWeight        = idx('weight_kg');
  const iSetsCompleted = idx('sets_completed');
  const iSetsTotal     = idx('sets_total');
  const iFullyDone     = idx('fully_completed');

  if ([iDate, iWorkoutType, iExercise, iWeight, iSetsCompleted, iSetsTotal].some((i) => i === -1)) {
    return { toImport: [], errors: ['CSV missing required columns (date, workout_type, exercise, weight_kg, sets_completed, sets_total)'] };
  }

  // Group rows by date
  const byDate = {};
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length < 2) continue;
    const date = row[iDate]?.trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push(`Row ${r + 1}: invalid date "${date}"`); continue; }
    if (!byDate[date]) byDate[date] = { rows: [], workoutType: row[iWorkoutType]?.trim()?.toUpperCase() ?? 'A', fullyCompleted: row[iFullyDone]?.trim() === 'yes' };
    byDate[date].rows.push(row);
  }

  const importTs = Date.now();
  const toImport = [];

  for (const [date, { rows: dateRows, workoutType, fullyCompleted }] of Object.entries(byDate)) {
    const exercises = {};
    let sessionFullyDone = true;

    for (const row of dateRows) {
      const exerciseName = row[iExercise]?.trim() ?? '';
      const key = NAME_TO_KEY[exerciseName.toLowerCase()];
      if (!key) { errors.push(`Unknown exercise: "${exerciseName}"`); continue; }

      const weight        = parseFloat(row[iWeight]) || 0;
      const setsCompleted = parseInt(row[iSetsCompleted], 10) || 0;
      const setsTotal     = parseInt(row[iSetsTotal],     10) || getSetsReps(key).sets;

      const sets = [
        ...Array.from({ length: setsCompleted }, () => ({ completed: true,  ts: importTs })),
        ...Array.from({ length: Math.max(0, setsTotal - setsCompleted) }, () => ({ completed: false, ts: importTs })),
      ];

      exercises[key] = { weight, sets };
      if (setsCompleted < setsTotal) sessionFullyDone = false;
    }

    if (Object.keys(exercises).length === 0) continue;

    toImport.push({
      id:           makeSessionId(date),
      date,
      sessionIndex: 0, // caller overwrites with correct index
      workoutType:  workoutType === 'B' ? 'B' : 'A',
      exercises,
      completed:    iFullyDone !== -1 ? fullyCompleted : sessionFullyDone,
      updatedAt:    importTs,
    });
  }

  toImport.sort((a, b) => a.date.localeCompare(b.date));
  return { toImport, errors };
};
