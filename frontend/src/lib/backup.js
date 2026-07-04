// Full JSON backup / restore of settings + all sessions.
//
// CSV export (lib/export.js) is a lossy, human-readable format; this is the
// lossless disaster-recovery path — everything round-trips bit-for-bit,
// including accessories, program tags and any future per-exercise fields.

export const BACKUP_FORMAT = 'stronglifts-backup';
export const BACKUP_VERSION = 1;

export const serializeBackup = (sessions, settings) =>
  JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      settings,
      sessions,
    },
    null,
    2,
  );

// Parse and validate a backup file. Invalid sessions are skipped with an error
// message rather than failing the whole restore.
export const parseBackup = (text) => {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { settings: null, sessions: [], errors: ['Not a valid JSON file'] };
  }
  if (data?.format !== BACKUP_FORMAT) {
    return { settings: null, sessions: [], errors: ['Not a StrongLifts backup file'] };
  }

  const errors = [];
  const settings =
    data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)
      ? data.settings
      : null;

  const sessions = [];
  for (const s of Array.isArray(data.sessions) ? data.sessions : []) {
    if (
      !s ||
      typeof s.id !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(s.date ?? '') ||
      typeof s.exercises !== 'object' ||
      s.exercises === null
    ) {
      errors.push(`Skipped invalid session entry: ${s?.id ?? s?.date ?? 'unknown'}`);
      continue;
    }
    sessions.push(s);
  }

  if (!settings && sessions.length === 0) {
    errors.push('Backup contains no usable data');
  }
  return { settings, sessions, errors };
};

export const exportBackupFile = (sessions, settings) => {
  const blob = new Blob([serializeBackup(sessions, settings)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stronglifts-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
