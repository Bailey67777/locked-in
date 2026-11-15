/**
 * Clean sounds, made on the device with the Web Audio API. Nothing to download, works offline.
 *
 * Twelve habit sounds, each built to be as different as possible from the others: different pitch, material and
 * shape (a glass ping, a wooden marimba, a long bell, a water drop, a plucked string, a low thud…). Each is rendered
 * once into a buffer and levelled so they all sit at the same loudness. Plus a chime when all ten are done and a
 * chord on submit.
 */

export type SoundDef = { id: string; name: string };

export const SOUNDS: SoundDef[] = [
  { id: "bell", name: "Bell" },
  { id: "glass", name: "Glass" },
  { id: "marimba", name: "Marimba" },
  { id: "drop", name: "Drop" },
  { id: "pluck", name: "Pluck" },
  { id: "rise", name: "Rise" },
  { id: "thud", name: "Thud" },
  { id: "knock", name: "Knock" },
  { id: "sonar", name: "Sonar" },
  { id: "swish", name: "Swish" },
  { id: "coin", name: "Coin" },
  { id: "snap", name: "Snap" },
  { id: "whistle", name: "Whistle" },
  { id: "zap", name: "Zap" },
];

export const SOUND_IDS = SOUNDS.map((s) => s.id);
export const isSound = (id: string | undefined): id is string => Boolean(id && SOUND_IDS.includes(id));
export const soundName = (id: string | undefined) => SOUNDS.find((s) => s.id === id)?.name ?? "None";

/* ---------- audio context (iOS only lets it start inside a tap) ---------- */

let ctx: AudioContext | null = null;
let unlocked = false;

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

/* ---------- a tiny sample synthesiser ---------- */

const TAU = Math.PI * 2;

type Synth = (sr: number) => Float32Array;

const len = (sr: number, s: number) => Math.max(1, Math.round(sr * s));

/** Add a decaying sine partial: frequency may sweep (from → to, exponential over `sweep` seconds). */
function addPartial(out: Float32Array, sr: number, o: { at?: number; f: number; to?: number; sweep?: number; gain: number; decay: number; attack?: number }) {
  const start = Math.round((o.at ?? 0) * sr);
  const attack = Math.max(1, Math.round((o.attack ?? 0.002) * sr));
  let phase = 0;
  for (let i = 0; start + i < out.length; i++) {
    const t = i / sr;
    const f = o.to && o.sweep ? o.f * Math.pow(o.to / o.f, Math.min(1, t / o.sweep)) : o.f;
    phase += (TAU * f) / sr;
    const env = (i < attack ? i / attack : 1) * Math.exp(-t / o.decay);
    if (env < 1e-5 && i > attack) break;
    out[start + i] += Math.sin(phase) * o.gain * env;
  }
}

/** Deterministic noise, so a sound is identical every time. */
function noise(n: number, seed = 1): Float32Array {
  const out = new Float32Array(n);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < n; i++) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    out[i] = ((s >>> 0) / 4294967296) * 2 - 1;
  }
  return out;
}

/** Two-pole band-pass (constant peak gain); `f` may change over time. */
function bandpass(x: Float32Array, sr: number, f: (t: number) => number, q: number): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const w = (TAU * Math.min(sr * 0.45, Math.max(20, f(i / sr)))) / sr;
    const al = Math.sin(w) / (2 * q);
    const a0 = 1 + al;
    const b0 = al / a0, b2 = -al / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - al) / a0;
    const v = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
    y[i] = v;
  }
  return y;
}

const SYNTHS: Record<string, Synth> = {
  // Long, metallic, slightly inharmonic: a small temple bell.
  bell: (sr) => {
    const out = new Float32Array(len(sr, 1.8));
    const f = 660;
    [[0.5, 0.35, 1.6], [1, 1, 1.3], [1.19, 0.45, 0.9], [1.56, 0.3, 0.7], [2, 0.35, 0.6], [2.74, 0.2, 0.4], [3.76, 0.12, 0.25]].forEach(([r, g, d]) => addPartial(out, sr, { f: f * r, gain: g, decay: d, attack: 0.001 }));
    return out;
  },
  // A high, pure ping, like tapping a glass.
  glass: (sr) => {
    const out = new Float32Array(len(sr, 0.9));
    addPartial(out, sr, { f: 2093, gain: 1, decay: 0.32 });
    addPartial(out, sr, { f: 2093 * 2.32, gain: 0.12, decay: 0.12 });
    addPartial(out, sr, { f: 2093 * 3.9, gain: 0.05, decay: 0.05 });
    return out;
  },
  // Warm and wooden, mid-pitched, with the marimba's bright fourth harmonic that dies fast.
  marimba: (sr) => {
    const out = new Float32Array(len(sr, 0.8));
    addPartial(out, sr, { f: 523.25, gain: 1, decay: 0.3, attack: 0.001 });
    addPartial(out, sr, { f: 523.25 * 3.93, gain: 0.45, decay: 0.035, attack: 0.001 });
    addPartial(out, sr, { f: 523.25 * 9.2, gain: 0.12, decay: 0.012, attack: 0.001 });
    return out;
  },
  // A water drop: a quick upward "bloop".
  drop: (sr) => {
    const out = new Float32Array(len(sr, 0.35));
    addPartial(out, sr, { f: 520, to: 1500, sweep: 0.06, gain: 1, decay: 0.07, attack: 0.001 });
    return out;
  },
  // A plucked nylon string (Karplus–Strong), low and round.
  pluck: (sr) => {
    const n = len(sr, 1.4);
    const out = new Float32Array(n);
    const period = Math.round(sr / 196);
    const line = noise(period, 7);
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const j = i % period;
      const v = line[j];
      out[i] = v;
      line[j] = 0.996 * 0.5 * (v + prev);
      prev = v;
    }
    // soften the bright pick a little
    for (let i = 1; i < n; i++) out[i] = out[i] * 0.6 + out[i - 1] * 0.4;
    return out;
  },
  // Three quick notes going up.
  rise: (sr) => {
    const out = new Float32Array(len(sr, 0.75));
    [1046.5, 1318.5, 1568].forEach((f, k) => {
      addPartial(out, sr, { at: k * 0.075, f, gain: 0.9, decay: k === 2 ? 0.28 : 0.09 });
      addPartial(out, sr, { at: k * 0.075, f: f * 2, gain: 0.08, decay: 0.05 });
    });
    return out;
  },
  // Low and soft, felt more than heard, with a small click so phone speakers still play it.
  thud: (sr) => {
    const out = new Float32Array(len(sr, 0.5));
    addPartial(out, sr, { f: 190, to: 62, sweep: 0.12, gain: 1, decay: 0.16, attack: 0.001 });
    addPartial(out, sr, { f: 380, to: 124, sweep: 0.08, gain: 0.35, decay: 0.06, attack: 0.001 });
    const click = bandpass(noise(len(sr, 0.02), 3), sr, () => 2500, 1.2);
    for (let i = 0; i < click.length; i++) out[i] += click[i] * 0.5 * (1 - i / click.length);
    return out;
  },
  // Two knocks on a wooden door.
  knock: (sr) => {
    const out = new Float32Array(len(sr, 0.45));
    for (const at of [0, 0.13]) {
      const n = len(sr, 0.07);
      const body = bandpass(noise(n, at ? 11 : 5), sr, () => 820, 6);
      const start = Math.round(at * sr);
      for (let i = 0; i < n; i++) out[start + i] += body[i] * 3 * Math.exp(-i / sr / 0.018);
      addPartial(out, sr, { at, f: 640, gain: 0.5, decay: 0.03, attack: 0.001 });
    }
    return out;
  },
  // A soft ping that echoes away.
  sonar: (sr) => {
    const out = new Float32Array(len(sr, 1.4));
    [0, 0.2, 0.4, 0.6].forEach((at, k) => addPartial(out, sr, { at, f: 988, gain: Math.pow(0.42, k), decay: 0.11, attack: 0.006 }));
    return out;
  },
  // Air moving past: a quick filtered whoosh upwards.
  swish: (sr) => {
    const n = len(sr, 0.42);
    const x = bandpass(noise(n, 21), sr, (t) => 400 * Math.pow(18, Math.min(1, t / 0.3)), 2.2);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = Math.sin(Math.PI * Math.min(1, t / 0.36)) ** 2;
      out[i] = x[i] * env;
    }
    return out;
  },
  // Two bright chip-tune notes, like an old game.
  coin: (sr) => {
    const out = new Float32Array(len(sr, 0.45));
    const square = (at: number, f: number, dur: number, decay: number) => {
      const s = Math.round(at * sr);
      for (let i = 0; i < len(sr, dur) && s + i < out.length; i++) {
        const t = i / sr;
        out[s + i] += (Math.sin(TAU * f * t) > 0 ? 0.5 : -0.5) * Math.exp(-t / decay);
      }
    };
    square(0, 987.77, 0.07, 0.2);
    square(0.07, 1318.5, 0.35, 0.12);
    // take the harsh top off
    for (let i = 1; i < out.length; i++) out[i] = out[i] * 0.45 + out[i - 1] * 0.55;
    return out;
  },
  // Someone whistling: a quick slide up, then a held note with a little vibrato.
  whistle: (sr) => {
    const n = len(sr, 0.6);
    const out = new Float32Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const base = t < 0.09 ? 1250 * Math.pow(1760 / 1250, t / 0.09) : 1760;
      const f = base * (1 + 0.012 * Math.sin(TAU * 6 * t) * Math.min(1, Math.max(0, (t - 0.12) / 0.1)));
      phase += (TAU * f) / sr;
      const env = Math.min(1, t / 0.02) * (t > 0.42 ? Math.exp(-(t - 0.42) / 0.05) : 1);
      out[i] = (Math.sin(phase) + 0.08 * Math.sin(2 * phase)) * env;
    }
    const air = bandpass(noise(n, 41), sr, () => 1760, 6);
    for (let i = 0; i < n; i++) out[i] += air[i] * 0.15 * Math.abs(out[i]);
    return out;
  },
  // A short laser zap: a buzzy tone diving from high to low.
  zap: (sr) => {
    const n = len(sr, 0.32);
    const out = new Float32Array(n);
    let phase = 0;
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const f = 1700 * Math.pow(170 / 1700, Math.min(1, t / 0.24));
      phase += f / sr;
      phase -= Math.floor(phase);
      const saw = 2 * phase - 1;
      lp += 0.35 * (saw - lp); // soften the buzz
      out[i] = lp * Math.exp(-t / 0.11) * Math.min(1, t / 0.002);
    }
    return out;
  },
  // A dry finger snap.
  snap: (sr) => {
    const n = len(sr, 0.12);
    const x = bandpass(noise(n, 33), sr, () => 2600, 1.6);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = x[i] * Math.exp(-i / sr / 0.014) * (i < sr * 0.0008 ? i / (sr * 0.0008) : 1);
    return out;
  },
  // The to-do tick: two quick notes stepping up, like a check mark being drawn. It is not in SOUNDS, so no habit
  // can have it: ticking a to-do never sounds like ticking a habit.
  todo: (sr) => {
    const out = new Float32Array(len(sr, 0.7));
    addPartial(out, sr, { f: 784, gain: 0.8, decay: 0.07, attack: 0.001 });
    addPartial(out, sr, { f: 784 * 2, gain: 0.15, decay: 0.04, attack: 0.001 });
    addPartial(out, sr, { at: 0.085, f: 1318.5, gain: 1, decay: 0.26, attack: 0.001 });
    addPartial(out, sr, { at: 0.085, f: 1318.5 * 2, gain: 0.18, decay: 0.12, attack: 0.001 });
    addPartial(out, sr, { at: 0.085, f: 1318.5 * 3.01, gain: 0.05, decay: 0.06, attack: 0.001 });
    return out;
  },
};

/** Level a buffer: the loudest 40 ms all sounds land at the same strength, peaks kept under 0.95. */
function level(x: Float32Array, sr: number) {
  const win = Math.max(1, Math.round(sr * 0.04));
  let maxRms = 0;
  let peak = 0;
  for (let s = 0; s < x.length; s += Math.round(win / 2)) {
    let sum = 0;
    const end = Math.min(x.length, s + win);
    for (let i = s; i < end; i++) sum += x[i] * x[i];
    maxRms = Math.max(maxRms, Math.sqrt(sum / win));
  }
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  if (!peak || !maxRms) return;
  const g = Math.min(0.2 / maxRms, 0.95 / peak);
  for (let i = 0; i < x.length; i++) x[i] *= g;
  // fade the last few ms so nothing clicks
  const fade = Math.min(x.length, Math.round(sr * 0.01));
  for (let i = 0; i < fade; i++) x[x.length - 1 - i] *= i / fade;
}

const cache = new Map<string, AudioBuffer>();

function bufferFor(c: AudioContext, id: string): AudioBuffer | null {
  const hit = cache.get(id);
  if (hit) return hit;
  const synth = SYNTHS[id];
  if (!synth) return null;
  const data = synth(c.sampleRate);
  level(data, c.sampleRate);
  const buf = c.createBuffer(1, data.length, c.sampleRate);
  buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
  cache.set(id, buf);
  return buf;
}

function playSynth(id: string) {
  const c = audio();
  if (!c) return;
  const buf = bufferFor(c, id);
  if (!buf) return;
  const src = c.createBufferSource();
  const g = c.createGain();
  g.gain.value = 0.75;
  src.buffer = buf;
  src.connect(g).connect(c.destination);
  src.start();
}

/** Play a habit's sound (or a quiet default if it has none). Call from inside the tap. */
export function playSound(id: string | undefined) {
  playSynth(isSound(id) ? id : "glass");
}

/** The sound of ticking a to-do: its own, different from every habit's. Call from inside the tap. */
export function playTodo() {
  playSynth("todo");
}

/* ---------- the rest: untick, all done, submit ---------- */

function note(c: AudioContext, freq: number, at: number, decay: number, gain: number) {
  for (const [r, gg, dd] of [[1, 1, 1], [2, 0.18, 0.5], [3, 0.06, 0.3]] as const) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.frequency.setValueAtTime(freq * r, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain * gg, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay * dd);
    osc.connect(g).connect(c.destination);
    osc.start(at);
    osc.stop(at + decay * dd + 0.05);
  }
}

export function playUntick() {
  const c = audio();
  if (!c) return;
  note(c, 392, c.currentTime + 0.005, 0.09, 0.05);
}

export function playAllDone() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.25;
  note(c, 1318.5, t, 0.6, 0.1);
  note(c, 1975.5, t + 0.11, 0.9, 0.09);
}

export function playSubmit() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.005;
  note(c, 523.25, t, 1.4, 0.1);
  note(c, 659.25, t + 0.07, 1.3, 0.08);
  note(c, 783.99, t + 0.14, 1.2, 0.07);
}

export function haptic(pattern: number | number[] = 10): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

// Dev only: render every sound offline and report its length and level, to check them without ears.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as Record<string, unknown>).__lockedInSounds = {
    SOUNDS,
    playSound,
    measure: () =>
      SOUNDS.map((s) => {
        const d = SYNTHS[s.id](44100);
        level(d, 44100);
        let peak = 0;
        let nonzero = 0;
        for (const v of d) {
          peak = Math.max(peak, Math.abs(v));
          if (Math.abs(v) > 0.001) nonzero++;
        }
        return { id: s.id, seconds: +(d.length / 44100).toFixed(2), peak: +peak.toFixed(2), audible: +(nonzero / 44100).toFixed(2), finite: d.every((v) => Number.isFinite(v)) };
      }),
  };
}
