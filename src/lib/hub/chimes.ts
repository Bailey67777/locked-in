/** Two soft sounds made on the device (nothing to download): a start tick and an end chime. */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call inside a tap so iOS lets sound play later (the end of a Stare at Wall). */
export function unlockAudio() {
  const a = audio();
  if (!a) return;
  const b = a.createBuffer(1, 1, 22050);
  const s = a.createBufferSource();
  s.buffer = b;
  s.connect(a.destination);
  s.start(0);
}

function bell(freq: number, at: number, dur: number, gain: number) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  for (const [mult, g] of [
    [1, 1],
    [2.76, 0.22],
    [5.4, 0.08],
  ] as const) {
    const o = a.createOscillator();
    const v = a.createGain();
    o.type = "sine";
    o.frequency.value = freq * mult;
    v.gain.setValueAtTime(0, t);
    v.gain.linearRampToValueAtTime(gain * g, t + 0.012);
    v.gain.exponentialRampToValueAtTime(0.0001, t + dur / mult);
    o.connect(v).connect(a.destination);
    o.start(t);
    o.stop(t + dur);
  }
}

export function playStart() {
  bell(880, 0, 0.5, 0.12);
}

export function playStop() {
  bell(660, 0, 0.6, 0.12);
}

/** Three gentle notes: the wall is done. */
export function playChime() {
  bell(523.25, 0, 2.4, 0.16);
  bell(659.25, 0.28, 2.4, 0.13);
  bell(783.99, 0.56, 3, 0.12);
}

export function haptic(pattern: number | number[] = 10) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}
