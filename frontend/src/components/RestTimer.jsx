import { useState, useEffect, useRef, useCallback } from 'react';
import { playAlarm, startKeepAlive, stopKeepAlive } from '../lib/audio';
import { notifyRestDone } from '../lib/notify';
import { saveRestTimer, clearRestTimer } from '../lib/restTimer';

export default function RestTimer({ seconds, onDone, onDismiss, compact = false, notifications = {} }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running,   setRunning]   = useState(true);

  const { enabled: notifyEnabled = false, sound = true, keepAwake = true } = notifications;

  // Stores the absolute timestamp when the timer should reach zero
  const endTimeRef   = useRef(0);
  const intervalRef  = useRef(null);
  const timeoutRef   = useRef(null);
  const firedRef     = useRef(false); // prevent double-fire

  const clearTick = () => {
    clearInterval(intervalRef.current);
    clearTimeout(timeoutRef.current);
  };

  // Everything that happens the moment rest is over. Guarded so the interval,
  // the deadline timeout and the visibility re-sync can't fire it twice.
  const fire = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    clearRestTimer();
    if (sound) playAlarm();
    if (notifyEnabled) notifyRestDone();
    onDone?.();
  }, [sound, notifyEnabled, onDone]);

  // Recompute remaining from the stored end timestamp
  const tick = useCallback(() => {
    const r = Math.ceil((endTimeRef.current - Date.now()) / 1000);
    if (r <= 0) {
      setRemaining(0);
      clearTick();
      setRunning(false);
      fire();
    } else {
      setRemaining(r);
    }
  }, [fire]);

  // App remounts RestTimer (via a fresh key) for every new timer, so the end
  // time only needs to be set once, on mount. Persisting it lets a relaunch
  // pick the rest back up — or report that it ended while the app was away.
  useEffect(() => {
    endTimeRef.current = Date.now() + seconds * 1000;
    saveRestTimer({ endsAt: endTimeRef.current, seconds });
  }, [seconds]);

  // Start / stop the interval
  useEffect(() => {
    if (!running) { clearTick(); return; }
    intervalRef.current = setInterval(tick, 500); // 500ms for snappier display
    // One long timeout alongside it: when iOS throttles background timers, a
    // single deadline lands far closer to zero than a coarse repeating tick.
    timeoutRef.current = setTimeout(tick, Math.max(0, endTimeRef.current - Date.now()) + 50);
    return clearTick;
  }, [running, tick]);

  // Hold an audio session open for the duration. iOS keeps a page with playing
  // audio alive, so the timer keeps counting with the screen locked and the
  // alarm is actually audible when it lands.
  useEffect(() => {
    if (!running || !keepAwake) return;
    startKeepAlive();
    return stopKeepAlive;
  }, [running, keepAwake]);

  // Re-sync when the tab / phone returns from background
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && running) tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [running, tick]);

  const pause = () => {
    if (!running) {
      // Resume: push end time forward by how much is left
      endTimeRef.current = Date.now() + remaining * 1000;
      saveRestTimer({ endsAt: endTimeRef.current, seconds });
      setRunning(true);
    } else {
      clearTick();
      clearRestTimer(); // a paused timer has no deadline to come back to
      setRunning(false);
    }
  };

  const restart = () => {
    clearTick();
    firedRef.current   = false;
    endTimeRef.current = Date.now() + seconds * 1000;
    saveRestTimer({ endsAt: endTimeRef.current, seconds });
    setRemaining(seconds);
    setRunning(true);
  };

  const skip = () => {
    clearTick();
    clearRestTimer();
    setRemaining(0);
    setRunning(false);
    // Skipping is deliberate — no alarm, no notification, just move on.
    if (!firedRef.current) { firedRef.current = true; onDone?.(); }
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct  = seconds > 0 ? remaining / seconds : 0;
  const circ = 2 * Math.PI * 54;

  if (compact) {
    return (
      <div className="bg-gray-900 border-t border-gray-800">
        <div className="h-3 bg-gray-800">
          <div
            className={`h-full transition-all duration-500 ${remaining === 0 ? 'bg-green-500' : 'bg-orange-500'}`}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <div className="flex items-center gap-3 px-4 py-6">
          <span className={`font-mono font-bold tabular-nums text-5xl ${remaining === 0 ? 'text-green-400' : 'text-white'}`}>
            {remaining === 0 ? 'Done!' : `${mins}:${String(secs).padStart(2, '0')}`}
          </span>
          <span className="text-gray-600 text-base flex-1">rest</span>
          <button onClick={pause} className="px-3 py-2 text-base bg-gray-800 hover:bg-gray-700 rounded-lg font-medium">
            {running ? 'Pause' : 'Resume'}
          </button>
          <button onClick={skip} className="px-3 py-2 text-base bg-gray-800 hover:bg-gray-700 rounded-lg font-medium">
            Skip
          </button>
          {onDismiss && (
            <button onClick={onDismiss} className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-white text-3xl leading-none ml-1">
              ×
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#1f2937" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="54" fill="none"
            stroke={remaining === 0 ? '#22c55e' : '#f97316'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-mono font-bold tabular-nums">
            {mins}:{String(secs).padStart(2, '0')}
          </span>
        </div>
      </div>

      {remaining === 0 && (
        <div className="text-green-400 font-semibold text-lg">Rest complete!</div>
      )}

      <div className="flex gap-3">
        <button onClick={pause}    className="px-5 py-2.5 bg-gray-800 rounded-xl text-sm font-medium hover:bg-gray-700">
          {running ? 'Pause' : 'Resume'}
        </button>
        <button onClick={restart}  className="px-5 py-2.5 bg-gray-800 rounded-xl text-sm font-medium hover:bg-gray-700">
          Restart
        </button>
        <button onClick={skip}     className="px-5 py-2.5 bg-gray-800 rounded-xl text-sm font-medium hover:bg-gray-700">
          Skip
        </button>
      </div>
    </div>
  );
}
