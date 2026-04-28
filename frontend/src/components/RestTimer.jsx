import { useState, useEffect, useRef, useCallback } from 'react';

const beep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.15, 0.3].forEach((delay) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.4, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.12);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.12);
    });
  } catch {}
};

export default function RestTimer({ seconds, onDone, onDismiss, compact = false }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running,   setRunning]   = useState(true);

  // Stores the absolute timestamp when the timer should reach zero
  const endTimeRef   = useRef(Date.now() + seconds * 1000);
  const intervalRef  = useRef(null);
  const firedRef     = useRef(false); // prevent double-beep

  const clearTick = () => clearInterval(intervalRef.current);

  // Recompute remaining from the stored end timestamp
  const tick = useCallback(() => {
    const r = Math.ceil((endTimeRef.current - Date.now()) / 1000);
    if (r <= 0) {
      setRemaining(0);
      clearTick();
      setRunning(false);
      if (!firedRef.current) {
        firedRef.current = true;
        beep();
        onDone?.();
      }
    } else {
      setRemaining(r);
    }
  }, [onDone]);

  // Reset when the `seconds` prop changes (new timer started)
  useEffect(() => {
    clearTick();
    firedRef.current  = false;
    endTimeRef.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
    setRunning(true);
  }, [seconds]);

  // Start / stop the interval
  useEffect(() => {
    if (!running) { clearTick(); return; }
    intervalRef.current = setInterval(tick, 500); // 500ms for snappier display
    return clearTick;
  }, [running, tick]);

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
      setRunning(true);
    } else {
      clearTick();
      setRunning(false);
    }
  };

  const restart = () => {
    clearTick();
    firedRef.current   = false;
    endTimeRef.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
    setRunning(true);
  };

  const skip = () => {
    clearTick();
    setRemaining(0);
    setRunning(false);
    if (!firedRef.current) { firedRef.current = true; onDone?.(); }
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct  = seconds > 0 ? remaining / seconds : 0;
  const circ = 2 * Math.PI * 54;

  if (compact) {
    return (
      <div className="border-b border-gray-800">
        <div className="h-0.5 bg-gray-800">
          <div
            className={`h-full transition-all duration-500 ${remaining === 0 ? 'bg-green-500' : 'bg-orange-500'}`}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5">
          <span className={`font-mono font-bold tabular-nums text-sm ${remaining === 0 ? 'text-green-400' : 'text-white'}`}>
            {remaining === 0 ? 'Rest done!' : `${mins}:${String(secs).padStart(2, '0')}`}
          </span>
          <span className="text-gray-600 text-xs flex-1">rest</span>
          <button onClick={pause} className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg font-medium">
            {running ? 'Pause' : 'Resume'}
          </button>
          <button onClick={skip} className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg font-medium">
            Skip
          </button>
          {onDismiss && (
            <button onClick={onDismiss} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-white text-xl leading-none ml-1">
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
