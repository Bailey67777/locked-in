/**
 * Fifty long, goofy sound effects, synthesised with the Web Audio API.
 * No files to download, works offline. Each lasts roughly 1.5–5 seconds.
 *
 * The 18 original ids are kept (habits already saved with them keep working) but every
 * sound was rebuilt to be longer and sillier. New habits get one picked at random,
 * nudged towards sounds whose tags match words in the habit's name.
 */

export type SoundDef = {
  id: string;
  name: string;
  emoji: string;
  /** Approximate length in seconds, shown in the picker. */
  dur: number;
  /** Words in a habit name that make this sound a good fit. */
  tags: string[];
  play: (ctx: AudioContext, at: number) => void;
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
  return ctx;
}

function out(c: AudioContext): AudioNode {
  return master ?? c.destination;
}

/* ---------- tiny synth toolkit ---------- */

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

type Curve = "exp" | "lin";

function envelope(c: AudioContext, at: number, dur: number, peak: number, attack = 0.01, hold = 0): GainNode {
  const g = c.createGain();
  const a = Math.min(attack, dur * 0.5);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + a);
  if (hold > 0) g.gain.setValueAtTime(Math.max(0.0002, peak), Math.min(at + a + hold, at + dur - 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  g.connect(out(c));
  return g;
}

type ToneOpts = {
  type?: OscillatorType;
  from: number;
  to?: number;
  at: number;
  dur: number;
  gain?: number;
  attack?: number;
  hold?: number;
  curve?: Curve;
  detune?: number;
  /** Vibrato / wobble: an LFO on the pitch. */
  vib?: { rate: number; depth: number; type?: OscillatorType };
  /** Optional low-pass to soften harsh waveforms. */
  lowpass?: number;
};

function tone(c: AudioContext, o: ToneOpts) {
  const osc = c.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(Math.max(1, o.from), o.at);
  if (o.detune) osc.detune.value = o.detune;
  if (o.to !== undefined) {
    if (o.curve === "lin") osc.frequency.linearRampToValueAtTime(Math.max(1, o.to), o.at + o.dur);
    else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), o.at + o.dur);
  }
  if (o.vib) {
    const lfo = c.createOscillator();
    lfo.type = o.vib.type ?? "sine";
    lfo.frequency.value = o.vib.rate;
    const lg = c.createGain();
    lg.gain.value = o.vib.depth;
    lfo.connect(lg).connect(osc.frequency);
    lfo.start(o.at);
    lfo.stop(o.at + o.dur + 0.05);
  }
  const g = envelope(c, o.at, o.dur, o.gain ?? 0.25, o.attack, o.hold);
  if (o.lowpass) {
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = o.lowpass;
    osc.connect(f).connect(g);
  } else {
    osc.connect(g);
  }
  osc.start(o.at);
  osc.stop(o.at + o.dur + 0.05);
}

type NoiseOpts = {
  at: number;
  dur: number;
  gain?: number;
  attack?: number;
  hold?: number;
  filter?: { type: BiquadFilterType; from: number; to?: number; q?: number };
};

function noise(c: AudioContext, o: NoiseOpts) {
  const len = Math.max(1, Math.ceil(c.sampleRate * (o.dur + 0.05)));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = envelope(c, o.at, o.dur, o.gain ?? 0.2, o.attack ?? 0.01, o.hold);
  let node: AudioNode = src;
  if (o.filter) {
    const f = c.createBiquadFilter();
    f.type = o.filter.type;
    f.frequency.setValueAtTime(o.filter.from, o.at);
    if (o.filter.to) f.frequency.exponentialRampToValueAtTime(o.filter.to, o.at + o.dur);
    f.Q.value = o.filter.q ?? 1;
    node.connect(f);
    node = f;
  }
  node.connect(g);
  src.start(o.at);
  src.stop(o.at + o.dur + 0.05);
}

/** Play notes one after another. Each: [frequency, seconds]. Returns the end time. */
function melody(c: AudioContext, at: number, notes: [number, number][], opts: Partial<ToneOpts> = {}, gap = 0.02): number {
  let t = at;
  for (const [f, d] of notes) {
    if (f > 0) tone(c, { type: "triangle", gain: 0.2, ...opts, from: f, at: t, dur: d });
    t += d + gap;
  }
  return t;
}

const N = { C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, B5: 988, C6: 1047, D6: 1175, E6: 1319, G6: 1568, C7: 2093 };

/* ---------- the sounds ---------- */

export const SOUNDS: SoundDef[] = [
  // ---- originals, now long and silly ----
  {
    id: "pop", name: "Bubble pops", emoji: "🫧", dur: 2.5, tags: ["water", "drink", "hydrate", "bath", "shower"],
    play: (c, t) => {
      let time = t;
      for (let i = 0; i < 12; i++) {
        tone(c, { from: rnd(500, 1100), to: rnd(200, 400), at: time, dur: 0.12, gain: 0.3 });
        time += rnd(0.1, 0.3);
      }
    },
  },
  {
    id: "ding", name: "Triple ding", emoji: "🔔", dur: 2.5, tags: ["bell", "reminder", "meditat"],
    play: (c, t) => {
      [0, 0.45, 0.9].forEach((d, i) => {
        tone(c, { type: "triangle", from: [1046, 1318, 1568][i], at: t + d, dur: 1.6, gain: 0.25 });
        tone(c, { type: "sine", from: [2093, 2637, 3136][i], at: t + d, dur: 1.0, gain: 0.08 });
      });
    },
  },
  {
    id: "chime", name: "Wind chimes", emoji: "🎐", dur: 3.5, tags: ["mobility", "breath", "stretch", "yoga", "calm", "meditat"],
    play: (c, t) => {
      const scale = [1047, 1175, 1319, 1568, 1760, 2093, 2349];
      let time = t;
      for (let i = 0; i < 9; i++) {
        tone(c, { type: "sine", from: pick(scale), at: time, dur: rnd(1.2, 2.2), gain: 0.14 });
        time += rnd(0.12, 0.4);
      }
    },
  },
  {
    id: "coin", name: "Coin shower", emoji: "🪙", dur: 3, tags: ["money", "save", "budget", "work"],
    play: (c, t) => {
      let time = t;
      for (let i = 0; i < 12; i++) {
        tone(c, { type: "square", from: 988, at: time, dur: 0.08, gain: 0.1 });
        tone(c, { type: "square", from: 1319, at: time + 0.08, dur: 0.25, gain: 0.1 });
        time += rnd(0.14, 0.3);
      }
    },
  },
  {
    id: "bubble", name: "Bubbles rising", emoji: "💧", dur: 3, tags: ["water", "drink", "hydrate", "swim", "lake", "sea"],
    play: (c, t) => {
      let time = t;
      for (let i = 0; i < 10; i++) {
        tone(c, { from: rnd(200, 350), to: rnd(700, 1200), at: time, dur: rnd(0.15, 0.3), gain: 0.22 });
        time += rnd(0.15, 0.35);
      }
    },
  },
  {
    id: "boing", name: "Boing boing", emoji: "🪀", dur: 3, tags: ["jump", "bounce", "trampoline", "fun"],
    play: (c, t) => {
      let time = t;
      for (let i = 0; i < 5; i++) {
        tone(c, { type: "sine", from: 500, to: 150, at: time, dur: 0.25, gain: 0.3 });
        tone(c, { type: "sine", from: 150, to: 320, at: time + 0.25, dur: 0.25, gain: 0.2, vib: { rate: 20, depth: 30 } });
        time += 0.6;
      }
    },
  },
  {
    id: "levelup", name: "Level up", emoji: "⬆️", dur: 3, tags: ["study", "learn", "revision", "homework", "practice", "improve"],
    play: (c, t) => {
      const end = melody(c, t, [[N.C5, 0.12], [N.E5, 0.12], [N.G5, 0.12], [N.C6, 0.12], [N.E6, 0.12], [N.G6, 0.5]], { type: "triangle", gain: 0.2 });
      for (let i = 0; i < 6; i++) tone(c, { type: "sine", from: rnd(2000, 4000), at: end + i * 0.12, dur: 0.6, gain: 0.08 });
    },
  },
  {
    id: "laser", name: "Laser battle", emoji: "🔫", dur: 3, tags: ["game", "play", "space", "video"],
    play: (c, t) => {
      let time = t;
      for (let i = 0; i < 9; i++) {
        tone(c, { type: "sawtooth", from: rnd(1000, 1800), to: rnd(120, 260), at: time, dur: 0.25, gain: 0.14 });
        time += rnd(0.18, 0.4);
      }
      noise(c, { at: time, dur: 0.8, gain: 0.25, filter: { type: "lowpass", from: 1500, to: 100 } });
    },
  },
  {
    id: "kick", name: "Drum roll + crash", emoji: "🥁", dur: 3.5, tags: ["big", "announce", "goal", "win"],
    play: (c, t) => {
      let time = t;
      let gap = 0.16;
      for (let i = 0; i < 26; i++) {
        noise(c, { at: time, dur: 0.06, gain: 0.25, filter: { type: "bandpass", from: 900, q: 0.7 } });
        tone(c, { from: 180, to: 60, at: time, dur: 0.08, gain: 0.3 });
        time += gap;
        gap = Math.max(0.05, gap * 0.92);
      }
      noise(c, { at: time, dur: 1.6, gain: 0.35, filter: { type: "highpass", from: 3000 } });
      tone(c, { from: 160, to: 40, at: time, dur: 0.5, gain: 0.5 });
    },
  },
  {
    id: "whoosh", name: "Whoosh swoosh", emoji: "💨", dur: 2.5, tags: ["run", "sprint", "fast", "bike", "cycle", "exercise", "workout", "cardio", "train"],
    play: (c, t) => {
      noise(c, { at: t, dur: 0.9, gain: 0.3, filter: { type: "bandpass", from: 300, to: 3500, q: 0.8 } });
      noise(c, { at: t + 0.8, dur: 1.2, gain: 0.3, filter: { type: "bandpass", from: 3500, to: 250, q: 0.8 } });
    },
  },
  {
    id: "honk", name: "Clown horn", emoji: "🤡", dur: 2.5, tags: ["silly", "fun", "joke"],
    play: (c, t) => {
      [0, 0.45].forEach((d) => {
        tone(c, { type: "sawtooth", from: 240, to: 200, at: t + d, dur: 0.3, gain: 0.15, curve: "lin", lowpass: 1500 });
        tone(c, { type: "square", from: 360, to: 300, at: t + d, dur: 0.3, gain: 0.06, curve: "lin" });
      });
      tone(c, { type: "sawtooth", from: 230, to: 160, at: t + 1.0, dur: 1.2, gain: 0.16, curve: "lin", vib: { rate: 8, depth: 12 }, lowpass: 1500 });
    },
  },
  {
    id: "quack", name: "Angry duck", emoji: "🦆", dur: 2.5, tags: ["pond", "lake", "outside", "walk"],
    play: (c, t) => {
      let time = t;
      for (let i = 0; i < 6; i++) {
        tone(c, { type: "square", from: rnd(450, 560), to: 300, at: time, dur: 0.16, gain: 0.11, curve: "lin" });
        tone(c, { type: "sawtooth", from: 240, to: 150, at: time, dur: 0.16, gain: 0.1, curve: "lin" });
        time += rnd(0.22, 0.45);
      }
    },
  },
  {
    id: "raspberry", name: "Raspberry", emoji: "😛", dur: 3, tags: ["no ", "don't", "stop", "quit", "avoid"],
    play: (c, t) => {
      tone(c, { type: "sawtooth", from: 95, to: 55, at: t, dur: 2.8, gain: 0.25, curve: "lin", vib: { rate: 28, depth: 25, type: "square" }, lowpass: 900 });
      noise(c, { at: t, dur: 2.8, gain: 0.12, hold: 2, filter: { type: "lowpass", from: 700, to: 250 } });
    },
  },
  {
    id: "sparkle", name: "Fairy dust", emoji: "✨", dur: 4, tags: ["clean", "tidy", "room", "bed", "wash"],
    play: (c, t) => {
      let time = t;
      for (let i = 0; i < 24; i++) {
        tone(c, { type: "sine", from: rnd(1800, 4200), at: time, dur: rnd(0.3, 0.9), gain: 0.07 });
        time += rnd(0.06, 0.22);
      }
    },
  },
  {
    id: "woodblock", name: "Woodpecker", emoji: "🐦", dur: 2.5, tags: ["nature", "tree", "outside", "park"],
    play: (c, t) => {
      let time = t;
      for (let burst = 0; burst < 3; burst++) {
        for (let i = 0; i < 7; i++) {
          tone(c, { type: "sine", from: 1300, to: 700, at: time, dur: 0.05, gain: 0.35 });
          time += 0.07;
        }
        time += 0.35;
      }
    },
  },
  {
    id: "cowbell", name: "More cowbell", emoji: "🐄", dur: 3, tags: ["music", "band", "dance"],
    play: (c, t) => {
      const pattern = [0, 0.3, 0.6, 0.75, 0.9, 1.2, 1.5, 1.65, 1.8, 2.1, 2.4];
      pattern.forEach((d) => {
        tone(c, { type: "square", from: 560, at: t + d, dur: 0.22, gain: 0.09, lowpass: 3000 });
        tone(c, { type: "square", from: 845, at: t + d, dur: 0.22, gain: 0.09, lowpass: 3000 });
      });
    },
  },
  {
    id: "tada", name: "Ta-da", emoji: "🎉", dur: 4, tags: ["done", "finish", "complete"],
    play: (c, t) => {
      melody(c, t, [[N.C5, 0.1], [N.E5, 0.1], [N.G5, 0.1], [N.C6, 0.9]], { type: "triangle", gain: 0.22 });
      tone(c, { type: "sine", from: N.E6, at: t + 0.35, dur: 1.4, gain: 0.1 });
      noise(c, { at: t + 0.35, dur: 0.8, gain: 0.08, filter: { type: "highpass", from: 5000 } });
      for (let i = 0; i < 14; i++) tone(c, { type: "sine", from: rnd(1500, 3500), at: t + 1.2 + i * 0.15, dur: 0.6, gain: 0.07 });
      melody(c, t + 2.2, [[N.G5, 0.1], [N.C6, 0.1], [N.E6, 0.1], [N.G6, 1.2]], { type: "triangle", gain: 0.2 });
    },
  },
  {
    id: "fanfare", name: "Royal fanfare", emoji: "🏆", dur: 5, tags: ["champion", "win", "trophy", "best"],
    play: (c, t) => {
      const seq: [number, number][] = [[N.G4, 0.13], [N.G4, 0.13], [N.G4, 0.13], [N.C5, 0.45], [N.E5, 0.13], [N.E5, 0.13], [N.E5, 0.13], [N.G5, 0.45], [N.C6, 0.13], [N.B5, 0.13], [N.A5, 0.13], [N.G5, 0.13], [N.F5, 0.13], [N.E5, 0.13], [N.D5, 0.13], [N.C5, 1.5]];
      melody(c, t, seq, { type: "square", gain: 0.08, lowpass: 2500 });
      melody(c, t, seq.map(([f, d]) => [f / 2, d]), { type: "triangle", gain: 0.14 });
      noise(c, { at: t + 3.3, dur: 1.5, gain: 0.15, filter: { type: "highpass", from: 4000 } });
    },
  },

  // ---- new ----
  {
    id: "siren", name: "Police siren", emoji: "🚨", dur: 4, tags: ["no ", "stop", "ban", "quit", "avoid", "police"],
    play: (c, t) => {
      tone(c, { type: "sawtooth", from: 800, at: t, dur: 4, gain: 0.12, hold: 3.5, vib: { rate: 0.9, depth: 300, type: "triangle" }, lowpass: 2500 });
      tone(c, { type: "square", from: 802, at: t, dur: 4, gain: 0.05, hold: 3.5, vib: { rate: 0.9, depth: 300, type: "triangle" }, lowpass: 2500 });
    },
  },
  {
    id: "slidewhistle", name: "Slide whistle", emoji: "🎢", dur: 3, tags: ["fall", "silly", "slip"],
    play: (c, t) => {
      tone(c, { type: "sine", from: 380, to: 1500, at: t, dur: 1.2, gain: 0.25, hold: 0.8, vib: { rate: 6, depth: 10 } });
      tone(c, { type: "sine", from: 1500, to: 260, at: t + 1.25, dur: 1.6, gain: 0.25, hold: 1.2, vib: { rate: 6, depth: 10 } });
    },
  },
  {
    id: "bouncyball", name: "Bouncy ball", emoji: "🏀", dur: 3, tags: ["basketball", "ball", "sport", "hoop", "dribble", "squash", "tennis", "exercise", "workout", "train"],
    play: (c, t) => {
      let time = t;
      let gap = 0.55;
      for (let i = 0; i < 10; i++) {
        tone(c, { type: "sine", from: 260, to: 70, at: time, dur: 0.12, gain: 0.45 });
        noise(c, { at: time, dur: 0.04, gain: 0.15, filter: { type: "lowpass", from: 1200 } });
        time += gap;
        gap *= 0.75;
      }
    },
  },
  {
    id: "splat", name: "Fall + splat", emoji: "🍅", dur: 3, tags: ["fail", "miss", "oops", "junk", "sugar"],
    play: (c, t) => {
      tone(c, { type: "sine", from: 1200, to: 120, at: t, dur: 1.6, gain: 0.25, hold: 1.2, vib: { rate: 7, depth: 15 } });
      noise(c, { at: t + 1.65, dur: 0.5, gain: 0.4, filter: { type: "lowpass", from: 900, to: 150 } });
      tone(c, { type: "sine", from: 90, to: 35, at: t + 1.65, dur: 0.6, gain: 0.4 });
      tone(c, { type: "sawtooth", from: 200, to: 90, at: t + 2.2, dur: 0.6, gain: 0.08, curve: "lin", vib: { rate: 12, depth: 20 }, lowpass: 800 });
    },
  },
  {
    id: "modem", name: "Dial-up modem", emoji: "📠", dur: 5, tags: ["phone", "tech", "screen", "internet", "wifi", "social", "insta", "tiktok", "scroll"],
    play: (c, t) => {
      melody(c, t, [[N.G5, 0.12], [N.A5, 0.12], [N.C6, 0.12], [N.E5, 0.12], [N.D6, 0.12], [N.G5, 0.12], [N.B5, 0.12]], { type: "square", gain: 0.07 }, 0.03);
      tone(c, { type: "sine", from: 2100, at: t + 1.1, dur: 0.9, gain: 0.12, hold: 0.7 });
      tone(c, { type: "sine", from: 1200, at: t + 1.1, dur: 0.9, gain: 0.1, hold: 0.7 });
      tone(c, { type: "square", from: 1650, to: 1850, at: t + 2.05, dur: 0.6, gain: 0.08, hold: 0.4, vib: { rate: 30, depth: 200, type: "square" } });
      noise(c, { at: t + 2.7, dur: 2.2, gain: 0.18, hold: 1.8, filter: { type: "bandpass", from: 1800, q: 0.5 } });
      tone(c, { type: "sawtooth", from: 400, to: 800, at: t + 2.7, dur: 2.2, gain: 0.05, hold: 1.8, vib: { rate: 17, depth: 300, type: "sawtooth" } });
    },
  },
  {
    id: "robot", name: "Robot chatter", emoji: "🤖", dur: 3, tags: ["tech", "code", "computer", "ai", "phone"],
    play: (c, t) => {
      let time = t;
      for (let i = 0; i < 14; i++) {
        const d = rnd(0.08, 0.28);
        tone(c, { type: pick(["square", "sawtooth"]), from: rnd(300, 1600), to: rnd(300, 1600), at: time, dur: d, gain: 0.08, curve: "lin", vib: { rate: rnd(8, 40), depth: rnd(10, 120) }, lowpass: 2500 });
        time += d + rnd(0.02, 0.1);
      }
    },
  },
  {
    id: "meow", name: "Cat meow", emoji: "🐱", dur: 2.5, tags: ["cat", "pet", "cuddle"],
    play: (c, t) => {
      tone(c, { type: "sawtooth", from: 480, to: 950, at: t, dur: 0.5, gain: 0.1, hold: 0.3, vib: { rate: 9, depth: 12 }, lowpass: 2200 });
      tone(c, { type: "sawtooth", from: 950, to: 380, at: t + 0.5, dur: 0.8, gain: 0.1, hold: 0.4, vib: { rate: 9, depth: 12 }, lowpass: 2200 });
      tone(c, { type: "sawtooth", from: 520, to: 1000, at: t + 1.5, dur: 0.35, gain: 0.09, vib: { rate: 9, depth: 12 }, lowpass: 2200 });
      tone(c, { type: "sawtooth", from: 1000, to: 420, at: t + 1.85, dur: 0.5, gain: 0.09, vib: { rate: 9, depth: 12 }, lowpass: 2200 });
    },
  },
  {
    id: "moo", name: "Cow moo", emoji: "🐮", dur: 3, tags: ["milk", "protein", "beef", "steak", "food", "meal", "breakfast", "dinner", "eat"],
    play: (c, t) => {
      tone(c, { type: "sawtooth", from: 130, to: 175, at: t, dur: 0.8, gain: 0.16, hold: 0.5, vib: { rate: 6, depth: 6 }, lowpass: 900 });
      tone(c, { type: "sawtooth", from: 175, to: 110, at: t + 0.8, dur: 2.0, gain: 0.16, hold: 1.4, vib: { rate: 6, depth: 8 }, lowpass: 900 });
      tone(c, { type: "sine", from: 88, to: 55, at: t + 0.8, dur: 2.0, gain: 0.12, hold: 1.4 });
    },
  },
  {
    id: "bark", name: "Dog bark", emoji: "🐶", dur: 2.5, tags: ["dog", "walk", "pet"],
    play: (c, t) => {
      [0, 0.35, 1.1, 1.45, 1.8].forEach((d) => {
        noise(c, { at: t + d, dur: 0.18, gain: 0.35, filter: { type: "bandpass", from: 700, to: 300, q: 1.2 } });
        tone(c, { type: "sawtooth", from: 320, to: 130, at: t + d, dur: 0.18, gain: 0.2, lowpass: 1200 });
      });
    },
  },
  {
    id: "snore", name: "Snore", emoji: "😴", dur: 4.5, tags: ["sleep", "bed", "night", "lights", "wind down", "9pm", "10pm", "11pm", "rest", "nap"],
    play: (c, t) => {
      for (let i = 0; i < 4; i++) {
        const s = t + i * 1.1;
        noise(c, { at: s, dur: 0.7, gain: 0.3, attack: 0.3, filter: { type: "lowpass", from: 140, to: 260, q: 4 } });
        tone(c, { type: "sawtooth", from: 70, to: 95, at: s, dur: 0.7, gain: 0.12, attack: 0.3, vib: { rate: 22, depth: 25, type: "square" }, lowpass: 400 });
        tone(c, { type: "sine", from: 500, to: 380, at: s + 0.75, dur: 0.3, gain: 0.06, attack: 0.1 });
      }
    },
  },
  {
    id: "burp", name: "Burp", emoji: "🫢", dur: 1.8, tags: ["eat", "food", "meal", "snack", "fizzy", "drink", "breakfast", "lunch", "dinner"],
    play: (c, t) => {
      tone(c, { type: "sawtooth", from: 140, to: 60, at: t, dur: 1.2, gain: 0.3, hold: 0.6, vib: { rate: 24, depth: 40, type: "square" }, lowpass: 700 });
      noise(c, { at: t, dur: 1.2, gain: 0.14, hold: 0.6, filter: { type: "lowpass", from: 600, to: 200 } });
    },
  },
  {
    id: "spaceship", name: "Spaceship takeoff", emoji: "🚀", dur: 4.5, tags: ["launch", "start", "go", "morning", "wake", "up "],
    play: (c, t) => {
      tone(c, { type: "sawtooth", from: 60, to: 1400, at: t, dur: 3.2, gain: 0.14, hold: 2.5, lowpass: 3000 });
      noise(c, { at: t, dur: 4.2, gain: 0.3, attack: 0.5, hold: 2.5, filter: { type: "bandpass", from: 200, to: 4000, q: 0.6 } });
      for (let i = 0; i < 5; i++) tone(c, { type: "sine", from: rnd(2500, 4500), at: t + 3.2 + i * 0.15, dur: 0.8, gain: 0.08 });
    },
  },
  {
    id: "wahwah", name: "Sad trombone", emoji: "🎺", dur: 3.5, tags: ["miss", "fail", "oops", "no "],
    play: (c, t) => {
      const opts: Partial<ToneOpts> = { type: "sawtooth", gain: 0.13, hold: 0.35, vib: { rate: 5, depth: 8 }, lowpass: 1400 };
      melody(c, t, [[466, 0.5], [440, 0.5], [415, 0.5]], opts, 0.08);
      tone(c, { type: "sawtooth", from: 392, to: 300, at: t + 1.8, dur: 1.6, gain: 0.13, hold: 0.6, vib: { rate: 6, depth: 14 }, lowpass: 1400 });
    },
  },
  {
    id: "bells", name: "Church bells", emoji: "⛪", dur: 5, tags: ["sunday", "morning", "church", "review", "week"],
    play: (c, t) => {
      [0, 0.85, 1.7, 2.55, 3.4].forEach((d, i) => {
        const f = [N.C4, N.E4, N.G4, N.E4, N.C4][i];
        tone(c, { type: "sine", from: f, at: t + d, dur: 1.8, gain: 0.25 });
        tone(c, { type: "sine", from: f * 2.02, at: t + d, dur: 1.4, gain: 0.1 });
        tone(c, { type: "sine", from: f * 3.01, at: t + d, dur: 1.0, gain: 0.06 });
        tone(c, { type: "triangle", from: f * 5.4, at: t + d, dur: 0.5, gain: 0.04 });
      });
    },
  },
  {
    id: "alarm", name: "Alarm clock", emoji: "⏰", dur: 3, tags: ["wake", "morning", "up ", "alarm", "6am", "7am", "on time"],
    play: (c, t) => {
      for (let g = 0; g < 3; g++) {
        for (let i = 0; i < 4; i++) {
          const s = t + g * 0.9 + i * 0.16;
          tone(c, { type: "square", from: 1000, at: s, dur: 0.09, gain: 0.1, hold: 0.06 });
          tone(c, { type: "square", from: 1500, at: s, dur: 0.09, gain: 0.05, hold: 0.06 });
        }
      }
    },
  },
  {
    id: "kazoo", name: "Kazoo solo", emoji: "🎶", dur: 3.5, tags: ["music", "sing", "guitar", "practice", "instrument"],
    play: (c, t) => {
      melody(c, t, [[N.E5, 0.3], [N.D5, 0.3], [N.C5, 0.3], [N.D5, 0.3], [N.E5, 0.3], [N.E5, 0.3], [N.E5, 0.6], [N.D5, 0.3], [N.D5, 0.3], [N.D5, 0.6]], { type: "sawtooth", gain: 0.1, vib: { rate: 32, depth: 18, type: "square" }, lowpass: 2500 }, 0.03);
    },
  },
  {
    id: "chicken", name: "Chicken", emoji: "🐔", dur: 3, tags: ["chicken", "egg", "breakfast", "protein", "food"],
    play: (c, t) => {
      let time = t;
      for (let i = 0; i < 5; i++) {
        tone(c, { type: "square", from: rnd(650, 800), to: 400, at: time, dur: 0.1, gain: 0.08, lowpass: 2500 });
        time += rnd(0.16, 0.3);
      }
      tone(c, { type: "square", from: 500, to: 900, at: time, dur: 0.35, gain: 0.09, lowpass: 2500, vib: { rate: 10, depth: 30 } });
      tone(c, { type: "square", from: 900, to: 300, at: time + 0.35, dur: 0.9, gain: 0.09, hold: 0.4, lowpass: 2500, vib: { rate: 10, depth: 30 } });
    },
  },
  {
    id: "cuckoo", name: "Cuckoo clock", emoji: "🕰️", dur: 3, tags: ["time", "hour", "clock", "schedule", "block"],
    play: (c, t) => {
      for (let i = 0; i < 3; i++) {
        const s = t + i * 0.95;
        tone(c, { type: "sine", from: 784, at: s, dur: 0.32, gain: 0.25, hold: 0.2 });
        tone(c, { type: "sine", from: 622, at: s + 0.36, dur: 0.45, gain: 0.25, hold: 0.25 });
      }
    },
  },
  {
    id: "applause", name: "Applause", emoji: "👏", dur: 4, tags: ["done", "finish", "complete", "perform", "present"],
    play: (c, t) => {
      let time = t;
      let density = 0.05;
      while (time < t + 3.8) {
        noise(c, { at: time, dur: rnd(0.03, 0.07), gain: rnd(0.15, 0.35), filter: { type: "bandpass", from: rnd(1200, 2600), q: 1.5 } });
        time += density * rnd(0.5, 1.5);
        if (time > t + 2.4) density += 0.006;
      }
    },
  },
  {
    id: "typewriter", name: "Typewriter", emoji: "⌨️", dur: 3.5, tags: ["study", "essay", "write", "homework", "notes", "journal", "read", "economics", "physics", "maths"],
    play: (c, t) => {
      let time = t;
      for (let i = 0; i < 16; i++) {
        noise(c, { at: time, dur: 0.035, gain: 0.35, filter: { type: "highpass", from: 2500 } });
        tone(c, { type: "square", from: 2200, at: time, dur: 0.02, gain: 0.05 });
        time += rnd(0.09, 0.22);
      }
      tone(c, { type: "sine", from: 2093, at: time, dur: 0.9, gain: 0.2 });
      noise(c, { at: time + 0.3, dur: 0.5, gain: 0.15, filter: { type: "bandpass", from: 800, to: 300, q: 0.7 } });
    },
  },
  {
    id: "wave", name: "Ocean wave", emoji: "🌊", dur: 5, tags: ["sea", "beach", "surf", "swim", "cold", "shower", "ocean"],
    play: (c, t) => {
      noise(c, { at: t, dur: 5, gain: 0.35, attack: 1.6, hold: 1.2, filter: { type: "lowpass", from: 350, to: 2500, q: 0.5 } });
      noise(c, { at: t + 2.2, dur: 2.8, gain: 0.25, attack: 0.3, filter: { type: "highpass", from: 1800, to: 600 } });
    },
  },
  {
    id: "birds", name: "Morning birds", emoji: "🐦‍⬛", dur: 4, tags: ["sun", "light", "outside", "morning", "walk", "garden", "park", "nature"],
    play: (c, t) => {
      let time = t;
      for (let i = 0; i < 12; i++) {
        const base = rnd(2000, 3400);
        tone(c, { type: "sine", from: base, to: base * rnd(1.2, 1.6), at: time, dur: 0.09, gain: 0.12 });
        tone(c, { type: "sine", from: base * 1.5, to: base * 0.9, at: time + 0.1, dur: 0.12, gain: 0.12 });
        time += rnd(0.12, 0.5);
      }
    },
  },
  {
    id: "thunder", name: "Thunder", emoji: "⛈️", dur: 4.5, tags: ["power", "heavy", "lift", "gym", "deadlift", "strength", "workout", "exercise", "train"],
    play: (c, t) => {
      noise(c, { at: t, dur: 0.25, gain: 0.5, filter: { type: "highpass", from: 1500 } });
      noise(c, { at: t + 0.1, dur: 4.2, gain: 0.5, attack: 0.05, hold: 1.5, filter: { type: "lowpass", from: 260, to: 60, q: 1 } });
      tone(c, { type: "sine", from: 55, to: 30, at: t + 0.1, dur: 3.5, gain: 0.35, hold: 1.5 });
    },
  },
  {
    id: "gameover", name: "Game over", emoji: "🎮", dur: 3, tags: ["game", "video", "console", "no gaming", "xbox", "playstation"],
    play: (c, t) => {
      melody(c, t, [[N.C5, 0.18], [N.B4, 0.18], [N.A4, 0.18], [N.G4, 0.18], [N.F4, 0.18], [N.E4, 0.18], [N.D4, 0.4]], { type: "square", gain: 0.08, lowpass: 2500 }, 0.03);
      tone(c, { type: "square", from: N.C4, to: N.C4 / 2, at: t + 1.7, dur: 1.2, gain: 0.08, hold: 0.5, lowpass: 2000 });
    },
  },
  {
    id: "powerup", name: "Power up", emoji: "⚡", dur: 2.5, tags: ["energy", "coffee", "electro", "boost", "push", "press", "exercise", "workout", "gym", "train"],
    play: (c, t) => {
      tone(c, { type: "sawtooth", from: 120, to: 1800, at: t, dur: 1.0, gain: 0.12, hold: 0.6, lowpass: 3000 });
      melody(c, t + 1.0, [[N.C5, 0.08], [N.E5, 0.08], [N.G5, 0.08], [N.C6, 0.08], [N.E6, 0.08], [N.G6, 0.08], [N.C7, 0.6]], { type: "square", gain: 0.07 }, 0.01);
      tone(c, { type: "sine", from: N.C7, at: t + 1.6, dur: 0.9, gain: 0.1, vib: { rate: 12, depth: 40 } });
    },
  },
  {
    id: "victory", name: "Victory jingle", emoji: "🥇", dur: 4, tags: ["win", "match", "game", "score", "beat"],
    play: (c, t) => {
      const seq: [number, number][] = [[N.C5, 0.15], [N.E5, 0.15], [N.G5, 0.15], [N.C6, 0.3], [N.G5, 0.15], [N.C6, 0.7]];
      melody(c, t, seq, { type: "triangle", gain: 0.2 }, 0.03);
      melody(c, t + 0.12, seq, { type: "sine", gain: 0.08 }, 0.03);
      melody(c, t + 1.9, [[N.E6, 0.12], [N.G6, 0.12], [N.C7, 1.4]], { type: "triangle", gain: 0.18 }, 0.03);
      noise(c, { at: t + 2.1, dur: 1.5, gain: 0.12, filter: { type: "highpass", from: 5000 } });
    },
  },
  {
    id: "howl", name: "Wolf howl", emoji: "🐺", dur: 3.5, tags: ["night", "moon", "late", "dark"],
    play: (c, t) => {
      tone(c, { type: "sawtooth", from: 280, to: 720, at: t, dur: 1.2, gain: 0.12, hold: 0.9, vib: { rate: 5, depth: 6 }, lowpass: 1600 });
      tone(c, { type: "sawtooth", from: 720, to: 700, at: t + 1.2, dur: 1.0, gain: 0.12, hold: 0.8, curve: "lin", vib: { rate: 6, depth: 12 }, lowpass: 1600 });
      tone(c, { type: "sawtooth", from: 700, to: 320, at: t + 2.2, dur: 1.3, gain: 0.12, hold: 0.5, vib: { rate: 6, depth: 12 }, lowpass: 1600 });
    },
  },
  {
    id: "doorbell", name: "Doorbell", emoji: "🚪", dur: 2.5, tags: ["friend", "mate", "visit", "social", "call"],
    play: (c, t) => {
      tone(c, { type: "sine", from: N.E5, at: t, dur: 0.9, gain: 0.25, hold: 0.3 });
      tone(c, { type: "sine", from: N.E5 * 2, at: t, dur: 0.5, gain: 0.06 });
      tone(c, { type: "sine", from: N.C5, at: t + 0.6, dur: 1.6, gain: 0.25, hold: 0.6 });
      tone(c, { type: "sine", from: N.C5 * 2, at: t + 0.6, dur: 0.8, gain: 0.06 });
    },
  },
  {
    id: "telephone", name: "Old phone ring", emoji: "☎️", dur: 4, tags: ["phone", "call", "mum", "dad", "family"],
    play: (c, t) => {
      [0, 2.0].forEach((d) => {
        tone(c, { type: "sine", from: 1000, at: t + d, dur: 1.2, gain: 0.14, hold: 1.0, vib: { rate: 22, depth: 400, type: "square" } });
        tone(c, { type: "sine", from: 1250, at: t + d, dur: 1.2, gain: 0.1, hold: 1.0, vib: { rate: 22, depth: 400, type: "square" } });
      });
    },
  },
  {
    id: "gallop", name: "Horse gallop", emoji: "🐎", dur: 3.5, tags: ["run", "jog", "sprint", "race", "fast", "exercise", "workout", "train"],
    play: (c, t) => {
      let time = t;
      for (let i = 0; i < 6; i++) {
        [0, 0.12, 0.22].forEach((d, j) => {
          tone(c, { type: "sine", from: j === 2 ? 140 : 110, to: 50, at: time + d, dur: 0.1, gain: 0.4 });
          noise(c, { at: time + d, dur: 0.05, gain: 0.15, filter: { type: "lowpass", from: 700 } });
        });
        time += 0.55;
      }
    },
  },
  {
    id: "helicopter", name: "Helicopter", emoji: "🚁", dur: 4, tags: ["travel", "trip", "fly", "bus", "commute"],
    play: (c, t) => {
      let time = t;
      let gap = 0.16;
      for (let i = 0; i < 30; i++) {
        noise(c, { at: time, dur: 0.09, gain: 0.3, filter: { type: "lowpass", from: 500, q: 1 } });
        tone(c, { type: "sine", from: 90, at: time, dur: 0.09, gain: 0.25 });
        time += gap;
        gap = Math.max(0.09, gap * 0.985);
      }
    },
  },
  {
    id: "airhorn", name: "Air horn", emoji: "📣", dur: 3, tags: ["hype", "party", "goal", "big", "max", "pb", "exercise", "workout"],
    play: (c, t) => {
      [0, 0.35, 0.7].forEach((d, i) => {
        const dur = i === 2 ? 2.2 : 0.28;
        tone(c, { type: "sawtooth", from: 220, to: 233, at: t + d, dur, gain: 0.12, hold: dur * 0.8, curve: "lin", lowpass: 3500 });
        tone(c, { type: "sawtooth", from: 330, to: 349, at: t + d, dur, gain: 0.1, hold: dur * 0.8, curve: "lin", lowpass: 3500 });
        tone(c, { type: "square", from: 440, to: 466, at: t + d, dur, gain: 0.04, hold: dur * 0.8, curve: "lin", lowpass: 3500 });
      });
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
    soundById(id).play(c, c.currentTime + 0.01);
  } catch {
    /* audio not available */
  }
}

/** A random sound, leaning towards ones whose tags match the habit's name, avoiding ones already in use. */
export function pickSoundForHabit(name: string, used: (string | undefined)[] = []): string {
  const n = name.toLowerCase();
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  // A tag matches at the start of a word ("sleep" → "sleeping", "meditat" → "meditation") but not inside one
  // ("fast" must not match "breakfast"). Multi-word tags match anywhere.
  const hits = (tag: string) => {
    const t = tag.trim();
    return t.includes(" ") ? n.includes(t) : words.some((w) => w.startsWith(t));
  };
  const usedSet = new Set(used.filter(Boolean));
  const matches = SOUNDS.filter((s) => s.tags.some(hits));
  const freshMatches = matches.filter((s) => !usedSet.has(s.id));
  const fresh = SOUNDS.filter((s) => !usedSet.has(s.id));
  const pool = freshMatches.length ? freshMatches : matches.length ? matches : fresh.length ? fresh : SOUNDS;
  return pick(pool).id;
}

export function randomSound(exclude?: string): string {
  const pool = SOUNDS.filter((s) => s.id !== exclude);
  return pick(pool).id;
}

export function haptic(pattern: number | number[] = 12): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}
