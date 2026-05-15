import { useState, useEffect, useCallback } from 'react';
import { getSettings, saveSettings, DEFAULT_SETTINGS, migrateSettings } from '../lib/db';
import { queueSync } from '../lib/sync';

export const useSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings().then((s) => {
      if (!s) {
        setSettings(DEFAULT_SETTINGS);
        setLoading(false);
        return;
      }
      const { settings: migrated, changed } = migrateSettings(s);
      setSettings(migrated);
      setLoading(false);
      if (changed) {
        saveSettings(migrated);
        queueSync('settings', migrated);
      }
    });
  }, []);

  const updateSettings = useCallback(async (updates) => {
    const next = { ...settings, ...updates };
    if (updates.weights)             next.weights             = { ...settings.weights,             ...updates.weights };
    if (updates.restTimers)          next.restTimers          = { ...settings.restTimers,          ...updates.restTimers };
    if (updates.increments)          next.increments          = { ...settings.increments,          ...updates.increments };
    if (updates.rom)                 next.rom                 = { ...settings.rom,                 ...updates.rom };
    if (updates.nextWeightOverrides) next.nextWeightOverrides = { ...settings.nextWeightOverrides, ...updates.nextWeightOverrides };
    setSettings(next);
    await saveSettings(next);
    queueSync('settings', next);
  }, [settings]);

  return { settings, loading, updateSettings };
};
