import { EXERCISES, getSetsReps, getWorkoutExercises } from './program';

export const exportSessionsCSV = (sessions) => {
  const header = ['date', 'workout_type', 'exercise', 'weight_kg', 'sets_completed', 'sets_total', 'fully_completed'];
  const rows = [header];

  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

  for (const session of sorted) {
    const exercises = getWorkoutExercises(session.workoutType);
    for (const key of exercises) {
      const ex = EXERCISES[key];
      const data = session.exercises?.[key];
      const { sets: total } = getSetsReps(key);
      const completed = data?.sets?.filter((s) => s.completed).length ?? 0;
      rows.push([
        session.date,
        session.workoutType ?? '',
        ex.name,
        data?.weight ?? '',
        completed,
        total,
        session.completed ? 'yes' : 'no',
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
