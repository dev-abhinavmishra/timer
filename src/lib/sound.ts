/* WebAudio sound design for the departure board.
   Everything is synthesized — relay clicks for flaps, a soft thunk when a
   leaf lands, and a two-tone station chime for completions/alarms. */

let ctx: AudioContext | null = null;
let unlocked = false;
let masterEnabled = true;

export function setSoundEnabled(on: boolean) {
  masterEnabled = on;
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

/* Browsers require a user gesture before audio — call once on first pointerdown. */
export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  ac();
}

function noiseBurst(c: AudioContext, durMs: number, hp = 2500, gain = 0.05, when = 0) {
  const t = c.currentTime + when;
  const len = Math.max(1, Math.floor((durMs / 1000) * c.sampleRate));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + durMs / 1000);
  src.connect(f); f.connect(g); g.connect(c.destination);
  src.start(t);
}

function thump(c: AudioContext, gain = 0.08, when = 0) {
  const t = c.currentTime + when;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.07);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + 0.1);
}

/* relay click — a flap starting to move */
export function flapTick(gain = 0.045) {
  if (!masterEnabled) return;
  const c = ac(); if (!c) return;
  noiseBurst(c, 7, 3000, gain);
}

/* soft mechanical land — flap settling */
export function flapLand(gain = 0.07) {
  if (!masterEnabled) return;
  const c = ac(); if (!c) return;
  noiseBurst(c, 12, 1200, gain * 0.6);
  thump(c, gain);
}

/* faint running tick each second while a countdown runs */
export function secondTick() {
  if (!masterEnabled) return;
  const c = ac(); if (!c) return;
  noiseBurst(c, 4, 4200, 0.016);
}

function note(c: AudioContext, freq: number, start: number, dur: number, gain = 0.16, type: OscillatorType = 'triangle') {
  const t = c.currentTime + start;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.025);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

/* station departure chime — two pairs, C4–E4 then A3–C4 feel */
export function stationChime() {
  if (!masterEnabled) return;
  const c = ac(); if (!c) return;
  const seq: [number, number, number][] = [
    [523.25, 0.0, 0.55],   // C5
    [659.25, 0.28, 0.55],  // E5
    [392.0, 0.62, 0.6],    // G4
    [523.25, 0.95, 0.9],   // C5
  ];
  seq.forEach(([f, s, d]) => {
    note(c, f, s, d, 0.14, 'triangle');
    note(c, f * 2, s, d * 0.6, 0.03, 'sine');
  });
}

/* louder repeating alarm — chime phrase + insistent beeps */
export function alarmRing() {
  if (!masterEnabled) return null;
  const c = ac(); if (!c) return null;
  let stopped = false;
  const fire = () => {
    if (stopped) return;
    [880, 880, 1108.73].forEach((f, i) => note(c, f, i * 0.22, 0.18, 0.12, 'square'));
    note(c, 523.25, 0.75, 0.6, 0.13, 'triangle');
    note(c, 659.25, 1.05, 0.7, 0.13, 'triangle');
  };
  fire();
  const iv = setInterval(fire, 2200);
  return () => { stopped = true; clearInterval(iv); };
}

/* generic short beep (kept API-compatible with old playBeep) */
export function playBeep(frequency = 440, duration = 200, volume = 0.1) {
  if (!masterEnabled) return;
  const c = ac(); if (!c) return;
  note(c, frequency, 0, duration / 1000, volume, 'sine');
}
