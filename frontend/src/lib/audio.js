// Rest-timer sound, built on plain <audio> elements rather than WebAudio.
//
// Why not WebAudio: iOS suspends an AudioContext as soon as the page goes to
// the background, which is exactly when the rest timer needs to be heard. A
// looping <audio> element, by contrast, holds an audio session open — the page
// keeps running (so the timer keeps ticking with the screen locked) and the
// alarm is audible over the lock screen.
//
// Both clips are synthesised into data-URI WAVs on first use: no extra assets
// to precache, and nothing to fetch when offline.

const SILENCE_RATE = 8000;   // keepalive fidelity is irrelevant — keep it small
const ALARM_RATE   = 22050;

// 16-bit mono PCM WAV from a Float32-ish sample array, as a data: URI.
const toWavDataUri = (samples, sampleRate) => {
  const bytes  = new ArrayBuffer(44 + samples.length * 2);
  const view   = new DataView(bytes);
  const ascii  = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);          // fmt chunk size
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);           // block align
  view.setUint16(34, 16, true);          // bits per sample
  ascii(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }

  let binary = '';
  const raw = new Uint8Array(bytes);
  for (let i = 0; i < raw.length; i++) binary += String.fromCharCode(raw[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
};

// One second of a 50 Hz tone at roughly -84 dBFS: inaudible, but *not* digital
// silence, which iOS is happy to optimise away along with the audio session.
// 50 whole periods per second, so the loop point is seamless.
const buildSilence = () => {
  const samples = new Float32Array(SILENCE_RATE);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.sin((2 * Math.PI * 50 * i) / SILENCE_RATE) * 0.00006;
  }
  return toWavDataUri(samples, SILENCE_RATE);
};

// Three 880 Hz blips with an exponential decay — the same pattern the old
// WebAudio beep() produced.
const buildAlarm = () => {
  const samples = new Float32Array(Math.round(ALARM_RATE * 0.5));
  for (const start of [0, 0.15, 0.3]) {
    const from = Math.round(start * ALARM_RATE);
    const len  = Math.round(0.12 * ALARM_RATE);
    for (let i = 0; i < len; i++) {
      const t = i / ALARM_RATE;
      samples[from + i] += Math.sin(2 * Math.PI * 880 * t) * 0.4 * Math.exp(-t / 0.035);
    }
  }
  return toWavDataUri(samples, ALARM_RATE);
};

let keepAliveEl = null;
let alarmEl     = null;
let keepAliveRefs = 0;

const makeEl = (src, loop) => {
  const el = document.createElement('audio');
  el.src = src;
  el.loop = loop;
  el.preload = 'auto';
  el.setAttribute('playsinline', '');
  return el;
};

const ensureElements = () => {
  if (typeof document === 'undefined') return false;
  if (!keepAliveEl) keepAliveEl = makeEl(buildSilence(), true);
  if (!alarmEl)     alarmEl     = makeEl(buildAlarm(), false);
  return true;
};

// Swallow autoplay rejections: no sound is a degraded timer, not a broken one.
const safePlay = (el) => {
  try {
    const p = el.play();
    if (p?.catch) p.catch(() => {});
    return p ?? Promise.resolve();
  } catch {
    return Promise.resolve();
  }
};

/**
 * Prime both clips inside a user gesture. iOS only lets an element play
 * programmatically once it has played at least once from a real tap, so this
 * must be called synchronously from the tap handler — before any `await`.
 */
export const unlockAudio = () => {
  if (!ensureElements()) return;
  // Muted play/pause unlocks the alarm without making a noise.
  alarmEl.muted = true;
  safePlay(alarmEl).finally(() => {
    alarmEl.pause();
    alarmEl.currentTime = 0;
    alarmEl.muted = false;
  });
  safePlay(keepAliveEl).finally(() => {
    if (keepAliveRefs === 0) keepAliveEl.pause();
  });
};

/** Hold the audio session open so background JS timers keep running. */
export const startKeepAlive = () => {
  if (!ensureElements()) return;
  keepAliveRefs += 1;
  if (keepAliveRefs === 1) safePlay(keepAliveEl);
};

/** Release one keepalive hold; the session closes when the last one goes. */
export const stopKeepAlive = () => {
  if (!keepAliveEl) return;
  keepAliveRefs = Math.max(0, keepAliveRefs - 1);
  if (keepAliveRefs === 0) {
    try { keepAliveEl.pause(); keepAliveEl.currentTime = 0; } catch { /* ignore */ }
  }
};

/** The rest-is-over beep. */
export const playAlarm = () => {
  if (!ensureElements()) return;
  try { alarmEl.currentTime = 0; } catch { /* not seekable yet */ }
  safePlay(alarmEl);
};
