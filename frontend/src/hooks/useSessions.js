import { useState, useEffect, useCallback } from 'react';
import { getAllSessions, saveSession, makeSessionId } from '../lib/db';
import { queueSync } from '../lib/sync';

export const useSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const all = await getAllSessions();
    all.sort((a, b) => a.date.localeCompare(b.date));
    setSessions(all);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const upsertSession = useCallback(async (session) => {
    await saveSession(session);
    queueSync('workouts', session);
    await reload();
  }, [reload]);

  return { sessions, loading, upsertSession, reload };
};
