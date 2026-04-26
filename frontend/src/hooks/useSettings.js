import { useState, useEffect, useCallback } from 'react';
import { getSettings, saveSettings, DEFAULT_SETTINGS } from '../lib/db';
import { queueSync } from '../lib/sync';

export const useSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s ?? DEFAULT_SETTINGS);
      setLoading(false);
    });
  }, []);

  const updateSettings = useCallback(async (updates) => {
    const next = { ...settings, ...updates };
    if (updates.weights) next.weights = { ...settings.weights, ...updates.weights };
    if (updates.restTimers) next.restTimers = { ...settings.restTimers, ...updates.restTimers };
    setSettings(next);
    await saveSettings(next);
    queueSync('settings', next);
  }, [settings]);

  return { settings, loading, updateSettings };
};
