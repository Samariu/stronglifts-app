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
