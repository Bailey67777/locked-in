/**
 * Small synthesised sound effects (Web Audio). No files to download, works offline.
 * Each sound is a short function drawing on an AudioContext created on first use.
 */

export type SoundDef = { id: string; name: string; emoji: string; play: (ctx: AudioContext, at: number) => void };

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
  return ctx;
}

type OscType = OscillatorType;

function tone(
  c: AudioContext,
  opts: { type?: OscType; from: number; to?: number; at: number; dur: number; gain?: number; attack?: number; curve?: "exp" | "lin"; detune?: number },
) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? "sine";
  o.frequency.setValueAtTime(opts.from, opts.at);
  if (opts.detune) o.detune.value = opts.detune;
  if (opts.to !== undefined) {
    if (opts.curve === "lin") o.frequency.linearRampToValueAtTime(opts.to, opts.at + opts.dur);
    else o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), opts.at + opts.dur);
  }
  const peak = opts.gain ?? 0.25;
  const attack = opts.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, opts.at);
  g.gain.exponentialRampToValueAtTime(peak, opts.at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, opts.at + opts.dur);
  o.connect(g).connect(c.destination);
  o.start(opts.at);
  o.stop(opts.at + opts.dur + 0.02);
}

function noise(c: AudioContext, opts: { at: number; dur: number; gain?: number; filter?: { type: BiquadFilterType; from: number; to?: number; q?: number } }) {
  const len = Math.ceil(c.sampleRate * opts.dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, opts.at);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.2, opts.at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, opts.at + opts.dur);
  let node: AudioNode = src;
  if (opts.filter) {
    const f = c.createBiquadFilter();
    f.type = opts.filter.type;
    f.frequency.setValueAtTime(opts.filter.from, opts.at);
    if (opts.filter.to) f.frequency.exponentialRampToValueAtTime(opts.filter.to, opts.at + opts.dur);
    f.Q.value = opts.filter.q ?? 1;
    node.connect(f);
    node = f;
  }
  node.connect(g).connect(c.destination);
  src.start(opts.at);
  src.stop(opts.at + opts.dur + 0.02);
}

export const SOUNDS: SoundDef[] = [
  {
    id: "pop", name: "Pop", emoji: "🫧",
    play: (c, t) => tone(c, { from: 700, to: 250, at: t, dur: 0.12, gain: 0.3 }),
  },
  {
    id: "ding", name: "Ding", emoji: "🔔",
    play: (c, t) => {
      tone(c, { type: "triangle", from: 1046, at: t, dur: 0.5, gain: 0.25 });
      tone(c, { type: "sine", from: 2093, at: t, dur: 0.3, gain: 0.08 });
    },
  },
  {
    id: "chime", name: "Chime", emoji: "🎐",
    play: (c, t) => {
      tone(c, { type: "sine", from: 784, at: t, dur: 0.35, gain: 0.22 });
      tone(c, { type: "sine", from: 1175, at: t + 0.12, dur: 0.5, gain: 0.2 });
    },
  },
  {
    id: "coin", name: "Coin", emoji: "🪙",
    play: (c, t) => {
      tone(c, { type: "square", from: 988, at: t, dur: 0.09, gain: 0.12 });
      tone(c, { type: "square", from: 1319, at: t + 0.09, dur: 0.35, gain: 0.12 });
    },
  },
  {
    id: "bubble", name: "Bubble", emoji: "💧",
    play: (c, t) => tone(c, { from: 300, to: 900, at: t, dur: 0.18, gain: 0.25 }),
  },
  {
    id: "boing", name: "Boing", emoji: "🪀",
    play: (c, t) => {
      tone(c, { type: "sine", from: 500, to: 150, at: t, dur: 0.25, gain: 0.3 });
      tone(c, { type: "sine", from: 150, to: 320, at: t + 0.25, dur: 0.2, gain: 0.2 });
    },
  },
  {
    id: "levelup", name: "Level up", emoji: "⬆️",
    play: (c, t) => {
      [523, 659, 784, 1047].forEach((f, i) => tone(c, { type: "triangle", from: f, at: t + i * 0.08, dur: 0.22, gain: 0.2 }));
    },
  },
  {
    id: "laser", name: "Laser", emoji: "🔫",
    play: (c, t) => tone(c, { type: "sawtooth", from: 1400, to: 180, at: t, dur: 0.25, gain: 0.15 }),
  },
  {
    id: "kick", name: "Drum", emoji: "🥁",
    play: (c, t) => {
      tone(c, { from: 160, to: 40, at: t, dur: 0.25, gain: 0.5 });
      noise(c, { at: t, dur: 0.05, gain: 0.15, filter: { type: "highpass", from: 3000 } });
    },
  },
  {
    id: "whoosh", name: "Whoosh", emoji: "💨",
    play: (c, t) => noise(c, { at: t, dur: 0.35, gain: 0.25, filter: { type: "bandpass", from: 400, to: 3000, q: 0.8 } }),
  },
  {
    id: "honk", name: "Honk", emoji: "📯",
    play: (c, t) => {
      tone(c, { type: "sawtooth", from: 220, to: 200, at: t, dur: 0.3, gain: 0.15, curve: "lin" });
      tone(c, { type: "square", from: 330, to: 300, at: t, dur: 0.3, gain: 0.06, curve: "lin" });
    },
  },
  {
    id: "quack", name: "Quack", emoji: "🦆",
    play: (c, t) => {
      tone(c, { type: "square", from: 480, to: 300, at: t, dur: 0.14, gain: 0.12, curve: "lin" });
      tone(c, { type: "sawtooth", from: 240, to: 150, at: t, dur: 0.14, gain: 0.1, curve: "lin" });
    },
  },
  {
    id: "raspberry", name: "Raspberry", emoji: "😛",
    play: (c, t) => {
      tone(c, { type: "sawtooth", from: 90, to: 60, at: t, dur: 0.4, gain: 0.25, curve: "lin" });
      noise(c, { at: t, dur: 0.4, gain: 0.12, filter: { type: "lowpass", from: 600, to: 250 } });
    },
  },
  {
    id: "sparkle", name: "Sparkle", emoji: "✨",
    play: (c, t) => {
      [1568, 2093, 2637, 3136, 2349].forEach((f, i) => tone(c, { type: "sine", from: f, at: t + i * 0.05, dur: 0.25, gain: 0.1 }));
    },
  },
  {
    id: "woodblock", name: "Woodblock", emoji: "🪵",
    play: (c, t) => {
      tone(c, { type: "sine", from: 1200, to: 700, at: t, dur: 0.07, gain: 0.35 });
    },
  },
  {
    id: "cowbell", name: "Cowbell", emoji: "🐄",
    play: (c, t) => {
      tone(c, { type: "square", from: 560, at: t, dur: 0.25, gain: 0.1 });
      tone(c, { type: "square", from: 845, at: t, dur: 0.25, gain: 0.1 });
    },
  },
  {
    id: "tada", name: "Ta-da", emoji: "🎉",
    play: (c, t) => {
      [523, 659, 784].forEach((f, i) => tone(c, { type: "triangle", from: f, at: t + i * 0.09, dur: 0.25, gain: 0.2 }));
      tone(c, { type: "triangle", from: 1047, at: t + 0.3, dur: 0.7, gain: 0.25 });
      tone(c, { type: "sine", from: 1319, at: t + 0.3, dur: 0.7, gain: 0.1 });
      noise(c, { at: t + 0.3, dur: 0.5, gain: 0.08, filter: { type: "highpass", from: 5000 } });
    },
  },
  {
    id: "fanfare", name: "Fanfare", emoji: "🏆",
    play: (c, t) => {
      const seq = [392, 392, 392, 523, 659, 784];
      seq.forEach((f, i) => tone(c, { type: "square", from: f, at: t + i * 0.11, dur: i === seq.length - 1 ? 0.8 : 0.12, gain: 0.09 }));
      seq.forEach((f, i) => tone(c, { type: "triangle", from: f / 2, at: t + i * 0.11, dur: i === seq.length - 1 ? 0.8 : 0.12, gain: 0.12 }));
    },
  },
];

export const SOUND_IDS = SOUNDS.map((s) => s.id);
export const DEFAULT_TODO_SOUND = "pop";
export const DEFAULT_DAY_COMPLETE_SOUND = "tada";

export function soundById(id: string | undefined): SoundDef {
  return SOUNDS.find((s) => s.id === id) ?? SOUNDS[0];
}

export function playSound(id: string | undefined): void {
  const c = getCtx();
  if (!c) return;
  try {
    soundById(id).play(c, c.currentTime);
  } catch {
    /* audio not available */
  }
}

export function haptic(pattern: number | number[] = 12): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}
