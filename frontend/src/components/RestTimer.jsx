import { useState, useEffect, useRef, useCallback } from 'react';

const beep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.15, 0.3].forEach((delay) => {
      const osc = ctx.createOscillator();
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

export default function RestTimer({ seconds, onDone }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(true);
  const interval = useRef(null);

  const clear = () => clearInterval(interval.current);

  useEffect(() => {
    setRemaining(seconds);
    setRunning(true);
  }, [seconds]);

  useEffect(() => {
    if (!running) { clear(); return; }
    interval.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval.current);
          setRunning(false);
          beep();
          onDone?.();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return clear;
  }, [running, onDone]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct = remaining / seconds;

  const circumference = 2 * Math.PI * 54;

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
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            className="transition-all duration-1000"
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
        <button
          onClick={() => setRunning((r) => !r)}
          className="px-5 py-2.5 bg-gray-800 rounded-xl text-sm font-medium hover:bg-gray-700"
        >
          {running ? 'Pause' : 'Resume'}
        </button>
        <button
          onClick={() => { clear(); setRemaining(seconds); setRunning(true); }}
          className="px-5 py-2.5 bg-gray-800 rounded-xl text-sm font-medium hover:bg-gray-700"
        >
          Restart
        </button>
        <button
          onClick={() => { clear(); setRemaining(0); setRunning(false); onDone?.(); }}
          className="px-5 py-2.5 bg-gray-800 rounded-xl text-sm font-medium hover:bg-gray-700"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
