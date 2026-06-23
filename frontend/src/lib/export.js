import { getSetsReps } from './program';
import { getActiveProgram, getExerciseMeta } from './programs';

export const exportSessionsCSV = (sessions, settings) => {
  const activeProgram = getActiveProgram(settings);
  const header = ['date', 'workout_type', 'exercise', 'weight_kg', 'sets_completed', 'sets_total', 'fully_completed', 'program'];
  const rows = [header];

  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

  for (const session of sorted) {
    // Iterate what was actually logged so swaps / accessories / any program export faithfully.
    for (const key of Object.keys(session.exercises ?? {})) {
      const meta = getExerciseMeta(key);
      const data = session.exercises?.[key];
      const total = data?.sets?.length || getSetsReps(key, activeProgram).sets;
      const completed = data?.sets?.filter((s) => s.completed).length ?? 0;
      rows.push([
        session.date,
        session.workoutType ?? '',
        meta?.name ?? key,
        data?.weight ?? '',
        completed,
        total,
        session.completed ? 'yes' : 'no',
        session.program ?? activeProgram.id,
      ]);
    }
  }

  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stronglifts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
