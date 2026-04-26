import { useState } from 'react';
import { useSettings } from './hooks/useSettings';
import { useSessions } from './hooks/useSessions';
import SetupWizard from './views/SetupWizard';
import TodayView from './views/TodayView';
import HistoryView from './views/HistoryView';
import ProgressView from './views/ProgressView';
import SettingsView from './views/SettingsView';
import BottomNav from './components/BottomNav';

export default function App() {
  const { settings, loading, updateSettings } = useSettings();
  const { sessions, upsertSession, removeSession } = useSessions();
  const [tab, setTab] = useState('today');

  if (loading) {
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
    <div className="flex flex-col h-dvh bg-gray-950 text-white overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-20">
        {tab === 'today' && (
          <TodayView sessions={sessions} settings={settings} upsertSession={upsertSession} />
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
          <SettingsView settings={settings} updateSettings={updateSettings} />
        )}
      </div>
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}
