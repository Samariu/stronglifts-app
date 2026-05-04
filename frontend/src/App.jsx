import { useState, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useSettings } from './hooks/useSettings';
import { useSessions } from './hooks/useSessions';
import SetupWizard from './views/SetupWizard';
import TodayView from './views/TodayView';
import HistoryView from './views/HistoryView';
import ProgressView from './views/ProgressView';
import SettingsView from './views/SettingsView';
import BottomNav from './components/BottomNav';
import RestTimer from './components/RestTimer';

export default function App() {
  const { settings, loading: settingsLoading, updateSettings } = useSettings();
  const { sessions, upsertSession, removeSession, loading: sessionsLoading } = useSessions();
  const [tab, setTab] = useState('today');
  const [timerSeconds, setTimerSeconds] = useState(null);
  const [timerKey, setTimerKey] = useState(0);

  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();

  const startTimer = useCallback((seconds) => {
    setTimerSeconds(seconds);
    setTimerKey((k) => k + 1);
  }, []);

  const dismissTimer = useCallback(() => setTimerSeconds(null), []);

  if (settingsLoading || sessionsLoading) {
    return (
      <div className="flex items-center justify-center h-dvh bg-gray-950 text-white">
        <div className="text-xl font-semibold tracking-wide animate-pulse">StrongLifts 5×5</div>
      </div>
    );
  }

  if (!settings?.setupComplete) {
    return (
      <SetupWizard
        onComplete={(s) => updateSettings({ ...s, setupComplete: true })}
      />
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-gray-950 text-white overflow-hidden pt-[env(safe-area-inset-top)]">
      {needRefresh && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-orange-500 text-white text-sm shrink-0">
          <span className="font-medium">Update available</span>
          <div className="flex gap-4">
            <button onClick={() => updateServiceWorker(true)} className="font-bold underline">
              Reload
            </button>
            <button onClick={() => setNeedRefresh(false)} className="text-white/70">
              Later
            </button>
          </div>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto ${timerSeconds !== null ? 'pb-[calc(8rem+env(safe-area-inset-bottom))]' : 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]'}`}>
        {tab === 'today' && (
          <TodayView sessions={sessions} settings={settings} upsertSession={upsertSession} onStartTimer={startTimer} />
        )}
        {tab === 'history' && (
          <HistoryView
            sessions={sessions}
            settings={settings}
            upsertSession={upsertSession}
            removeSession={removeSession}
          />
        )}
        {tab === 'progress' && (
          <ProgressView sessions={sessions} settings={settings} />
        )}
        {tab === 'settings' && (
          <SettingsView
            settings={settings}
            sessions={sessions}
            updateSettings={updateSettings}
            needRefresh={needRefresh}
            updateServiceWorker={updateServiceWorker}
          />
        )}
      </div>

      {/* Fixed footer: compact rest timer (when active) + bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900">
        {timerSeconds !== null && (
          <RestTimer
            key={timerKey}
            seconds={timerSeconds}
            compact
            onDone={() => {}}
            onDismiss={dismissTimer}
          />
        )}
        <BottomNav tab={tab} setTab={setTab} />
      </div>
    </div>
  );
}
