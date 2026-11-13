/**
 * Three quiet sounds, made on the spot with the Web Audio API: a soft tick, a two-note chime when every habit
 * is done, and a low three-note chord when the day is submitted. Nothing to download, works offline.
 */

let ctx: AudioContext | null = null;
let unlocked = false;

/** Must be called inside a tap the first time: iOS only lets audio start from a user gesture. */
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
  if (!unlocked) {
    try {
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
      unlocked = true;
    } catch {
      /* ignore */
    }
  }
  return ctx;
}

/** One sine partial with a fast attack and a natural decay. */
function partial(c: AudioContext, freq: number, at: number, decay: number, gain: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  osc.connect(g).connect(c.destination);
  osc.start(at);
  osc.stop(at + decay + 0.05);
}

/** A small glassy note: fundamental plus a quiet octave and twelfth. */
function note(c: AudioContext, freq: number, at: number, decay: number, gain: number) {
  partial(c, freq, at, decay, gain);
  partial(c, freq * 2, at, decay * 0.5, gain * 0.18);
  partial(c, freq * 3, at, decay * 0.3, gain * 0.06);
}

export function playTick() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.005;
  note(c, 1568, t, 0.16, 0.14); // G6, short
}

export function playUntick() {
  const c = audio();
  if (!c) return;
  partial(c, 784, c.currentTime + 0.005, 0.08, 0.06); // G5, barely there
}

export function playAllDone() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.12;
  note(c, 1318.5, t, 0.6, 0.12); // E6
  note(c, 1975.5, t + 0.11, 0.9, 0.1); // B6
}

export function playSubmit() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.005;
  note(c, 523.25, t, 1.4, 0.1); // C5
  note(c, 659.25, t + 0.07, 1.3, 0.08); // E5
  note(c, 783.99, t + 0.14, 1.2, 0.07); // G5
}

export function haptic(pattern: number | number[] = 10): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}
