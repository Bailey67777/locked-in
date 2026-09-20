/**
 * Fifty long, daft sound effects, synthesised with the Web Audio API. No files, works offline.
 *
 * Every sound is rendered offline first, measured, and normalised to the SAME loudness (measured the way a
 * phone speaker hears it: bass mostly ignored), then pushed through a soft limiter so it can be played loud
 * without clipping. That is why a snore and an air horn now come out at the same volume.
 *
 * The 50 ids never change (saved habits point at them); what each id sounds like can.
 */

export type SoundDef = {
  id: string;
  name: string;
  emoji: string;
  /** Length in seconds (also the render length). */
  dur: number;
  /** Words in a habit name that make this sound a good fit. */
  tags: string[];
  play: (ctx: BaseAudioContext, at: number) => void;
};

/* ---------- tiny synth toolkit ---------- */

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

type Sweep = number | [number, number];
type Formant = { f: number; q?: number; g?: number };

type Shape = {
  at: number;
  dur: number;
  gain?: number;
  attack?: number;
  /** Seconds to stay at full level before fading. */
  hold?: number;
  lowpass?: Sweep;
  highpass?: Sweep;
  bandpass?: { f: Sweep; q?: number };
  /** Parallel band-pass filters: gives a throat / vowel quality. */
  formants?: Formant[];
  /** Distortion amount (0–100). */
  drive?: number;
  /** Tremolo: volume wobble. depth 0–1. */
  trem?: { rate: Sweep; depth: number; type?: OscillatorType };
};

function sweep(p: AudioParam, v: Sweep, at: number, dur: number) {
  if (typeof v === "number") p.setValueAtTime(Math.max(1, v), at);
  else {
    p.setValueAtTime(Math.max(1, v[0]), at);
    p.exponentialRampToValueAtTime(Math.max(1, v[1]), at + dur);
  }
}

const curves = new Map<number, Float32Array<ArrayBuffer>>();
function driveCurve(amount: number): Float32Array<ArrayBuffer> {
  const hit = curves.get(amount);
  if (hit) return hit;
  const n = 2048;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const k = amount;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  curves.set(amount, curve);
  return curve;
}

/** source → [drive] → [formants | filters] → [tremolo] → envelope → destination */
function shape(c: BaseAudioContext, src: AudioNode, o: Shape) {
  let node: AudioNode = src;
  if (o.drive) {
    const ws = c.createWaveShaper();
    ws.curve = driveCurve(o.drive);
    node.connect(ws);
    node = ws;
  }
  if (o.formants?.length) {
    const sum = c.createGain();
    sum.gain.value = 1;
    for (const fm of o.formants) {
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = fm.f;
      bp.Q.value = fm.q ?? 6;
      const g = c.createGain();
      g.gain.value = fm.g ?? 1;
      node.connect(bp);
      bp.connect(g);
      g.connect(sum);
    }
    node = sum;
  }
  const filters: [BiquadFilterType, Sweep | undefined, number][] = [
    ["lowpass", o.lowpass, 0.7],
    ["highpass", o.highpass, 0.7],
    ["bandpass", o.bandpass?.f, o.bandpass?.q ?? 1],
  ];
  for (const [type, v, q] of filters) {
    if (v === undefined) continue;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    sweep(f.frequency, v, o.at, o.dur);
    node.connect(f);
    node = f;
  }
  if (o.trem) {
    const tg = c.createGain();
    tg.gain.value = 1 - o.trem.depth / 2;
    const lfo = c.createOscillator();
    lfo.type = o.trem.type ?? "sine";
    sweep(lfo.frequency, o.trem.rate, o.at, o.dur);
    const lg = c.createGain();
    lg.gain.value = o.trem.depth / 2;
    lfo.connect(lg);
    lg.connect(tg.gain);
    lfo.start(o.at);
    lfo.stop(o.at + o.dur + 0.05);
    node.connect(tg);
    node = tg;
  }
  const env = c.createGain();
  const peak = Math.max(0.0002, o.gain ?? 0.25);
  const a = Math.min(o.attack ?? 0.01, o.dur * 0.5);
  env.gain.setValueAtTime(0.0001, o.at);
  env.gain.exponentialRampToValueAtTime(peak, o.at + a);
  if (o.hold && o.hold > 0) env.gain.setValueAtTime(peak, Math.min(o.at + a + o.hold, o.at + o.dur - 0.01));
  env.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);
  node.connect(env);
  env.connect(c.destination);
}

type ToneOpts = Shape & {
  type?: OscillatorType;
  from: number;
  to?: number;
  curve?: "exp" | "lin";
  /** Pitch wobble. Slow = vibrato, fast (>40 Hz) = growl / metallic FM. */
  vib?: { rate: number; depth: number; type?: OscillatorType };
};

function tone(c: BaseAudioContext, o: ToneOpts) {
  const osc = c.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(Math.max(1, o.from), o.at);
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
    lfo.connect(lg);
    lg.connect(osc.frequency);
    lfo.start(o.at);
    lfo.stop(o.at + o.dur + 0.05);
  }
  shape(c, osc, o);
  osc.start(o.at);
  osc.stop(o.at + o.dur + 0.05);
}

function noise(c: BaseAudioContext, o: Shape) {
  const len = Math.max(1, Math.ceil(c.sampleRate * (o.dur + 0.05)));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  shape(c, src, o);
  src.start(o.at);
  src.stop(o.at + o.dur + 0.05);
}

/** Notes one after another: [frequency, seconds]. Returns the end time. */
function melody(c: BaseAudioContext, at: number, notes: [number, number][], opts: Partial<ToneOpts> = {}, gap = 0.02): number {
  let t = at;
  for (const [f, d] of notes) {
    if (f > 0) tone(c, { type: "sawtooth", gain: 0.2, lowpass: 2600, ...opts, from: f, at: t, dur: d });
    t += d + gap;
  }
  return t;
}

const N = { C3: 131, G3: 196, C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, B5: 988, C6: 1047, D6: 1175, E6: 1319, G6: 1568, C7: 2093 };

// Vowel-ish formants for throat sounds.
const AH: Formant[] = [{ f: 750, q: 5 }, { f: 1150, q: 6, g: 0.7 }, { f: 2600, q: 8, g: 0.3 }];
const OO: Formant[] = [{ f: 320, q: 5 }, { f: 850, q: 6, g: 0.5 }];
const EE: Formant[] = [{ f: 300, q: 5 }, { f: 2300, q: 8, g: 0.7 }, { f: 3000, q: 8, g: 0.4 }];
const NASAL: Formant[] = [{ f: 1000, q: 4 }, { f: 1900, q: 6, g: 0.7 }, { f: 3200, q: 8, g: 0.4 }];
const ROAR: Formant[] = [{ f: 380, q: 3 }, { f: 900, q: 4, g: 0.9 }, { f: 2100, q: 5, g: 0.5 }];

/* ---------- the sounds ---------- */

export const SOUNDS: SoundDef[] = [
  {
    id: "pop", name: "Popcorn", emoji: "🍿", dur: 3, tags: ["snack", "food", "film", "movie"],
    play: (c, t) => {
      let time = t;
      let gap = 0.4;
      while (time < t + 2.8) {
        noise(c, { at: time, dur: 0.06, gain: rnd(0.5, 0.9), bandpass: { f: rnd(900, 2800), q: 1.2 }, drive: 30 });
        tone(c, { from: rnd(400, 900), to: 140, at: time, dur: 0.05, gain: 0.4 });
        time += gap * rnd(0.4, 1.1);
        gap = time < t + 1.7 ? Math.max(0.028, gap * 0.78) : gap * 1.3;
      }
    },
  },
  {
    id: "ding", name: "Dinosaur roar", emoji: "🦖", dur: 3.6, tags: ["big", "strong", "beast", "lift", "gym", "deadlift", "squat"],
    play: (c, t) => {
      tone(c, { type: "sawtooth", from: 70, to: 130, at: t, dur: 0.7, gain: 0.5, attack: 0.25, hold: 0.4, vib: { rate: 38, depth: 28, type: "square" }, drive: 40, formants: ROAR });
      tone(c, { type: "sawtooth", from: 130, to: 55, at: t + 0.65, dur: 2.8, gain: 0.55, attack: 0.05, hold: 1.6, vib: { rate: 31, depth: 34, type: "square" }, drive: 60, formants: ROAR });
      tone(c, { type: "square", from: 190, to: 80, at: t + 0.65, dur: 2.6, gain: 0.2, hold: 1.5, vib: { rate: 47, depth: 50, type: "sawtooth" }, drive: 30, formants: ROAR });
      noise(c, { at: t + 0.3, dur: 3.1, gain: 0.35, attack: 0.4, hold: 1.6, bandpass: { f: [1400, 500], q: 0.8 }, trem: { rate: 29, depth: 0.7, type: "square" } });
    },
  },
  {
    id: "chime", name: "Fire alarm", emoji: "🚒", dur: 3.5, tags: ["no", "stop", "quit", "avoid", "emergency", "urgent"],
    play: (c, t) => {
      tone(c, { type: "square", from: 3150, at: t, dur: 3.4, gain: 0.3, hold: 3.2, trem: { rate: 4, depth: 1, type: "square" }, lowpass: 6000 });
      tone(c, { type: "square", from: 2880, at: t, dur: 3.4, gain: 0.25, hold: 3.2, trem: { rate: 4, depth: 1, type: "square" }, lowpass: 6000 });
      tone(c, { type: "sawtooth", from: 1575, at: t, dur: 3.4, gain: 0.12, hold: 3.2, trem: { rate: 4, depth: 1, type: "square" } });
    },
  },
  {
    id: "coin", name: "Slot machine jackpot", emoji: "🎰", dur: 3.6, tags: ["money", "save", "budget", "work", "job", "win"],
    play: (c, t) => {
      const loop = [N.C5, N.E5, N.G5, N.C6, N.G5, N.E5];
      let time = t;
      for (let i = 0; i < 26 && time < t + 2.4; i++) {
        tone(c, { type: "square", from: loop[i % loop.length] * (i > 14 ? 1.5 : 1), at: time, dur: 0.085, gain: 0.2, hold: 0.05, lowpass: 3500 });
        time += 0.09;
      }
      for (let i = 0; i < 22; i++) noise(c, { at: t + 1.2 + i * rnd(0.07, 0.12), dur: 0.05, gain: 0.35, highpass: rnd(3500, 6000) });
      tone(c, { type: "square", from: 1900, at: t + 2.4, dur: 1.1, gain: 0.25, hold: 0.9, trem: { rate: 24, depth: 1, type: "square" }, vib: { rate: 90, depth: 300 } });
    },
  },
  {
    id: "bubble", name: "Frog chorus", emoji: "🐸", dur: 3.4, tags: ["pond", "lake", "water", "drink", "hydrate", "swim"],
    play: (c, t) => {
      let time = t;
      while (time < t + 3) {
        const p = rnd(130, 210);
        tone(c, { type: "sawtooth", from: p, to: p * 0.9, at: time, dur: 0.16, gain: 0.5, hold: 0.1, trem: { rate: 34, depth: 1, type: "square" }, formants: [{ f: 850, q: 4 }, { f: 1700, q: 6, g: 0.6 }], drive: 20 });
        tone(c, { type: "sawtooth", from: p * 1.5, to: p * 1.7, at: time + 0.2, dur: 0.22, gain: 0.5, hold: 0.15, trem: { rate: 34, depth: 1, type: "square" }, formants: [{ f: 1000, q: 4 }, { f: 2100, q: 6, g: 0.6 }], drive: 20 });
        time += rnd(0.5, 0.8);
      }
    },
  },
  {
    id: "boing", name: "Spring boing", emoji: "🪀", dur: 3.2, tags: ["jump", "bounce", "trampoline", "fun", "skip"],
    play: (c, t) => {
      for (let i = 0; i < 3; i++) {
        const s = t + i * 1.0;
        tone(c, { type: "sawtooth", from: 700, to: 140, at: s, dur: 0.12, gain: 0.4, lowpass: 3000 });
        tone(c, { type: "triangle", from: 260 - i * 40, to: 200 - i * 40, at: s + 0.08, dur: 0.85, gain: 0.5, vib: { rate: 11 + i * 3, depth: 130 }, drive: 15 });
      }
    },
  },
  {
    id: "levelup", name: "Race car flyby", emoji: "🏎️", dur: 3.8, tags: ["fast", "speed", "drive", "race", "sprint"],
    play: (c, t) => {
      tone(c, { type: "sawtooth", from: 320, to: 980, at: t, dur: 1.9, gain: 0.45, attack: 0.9, hold: 0.9, vib: { rate: 60, depth: 60, type: "sawtooth" }, drive: 50, lowpass: [900, 5000] });
      tone(c, { type: "sawtooth", from: 980, to: 300, at: t + 1.9, dur: 1.8, gain: 0.45, attack: 0.01, vib: { rate: 60, depth: 40, type: "sawtooth" }, drive: 50, lowpass: [5000, 600] });
      noise(c, { at: t + 1.2, dur: 1.6, gain: 0.3, attack: 0.7, bandpass: { f: [600, 3000], q: 0.7 } });
    },
  },
  {
    id: "laser", name: "Laser battle", emoji: "🔫", dur: 3.4, tags: ["game", "play", "space", "video"],
    play: (c, t) => {
      let time = t;
      while (time < t + 2.3) {
        tone(c, { type: "sawtooth", from: rnd(1400, 2600), to: rnd(150, 300), at: time, dur: 0.22, gain: 0.35, drive: 20 });
        time += rnd(0.16, 0.36);
      }
      noise(c, { at: time, dur: 1.0, gain: 0.6, lowpass: [4000, 150], drive: 40 });
      tone(c, { from: 120, to: 30, at: time, dur: 0.9, gain: 0.5, drive: 30 });
    },
  },
  {
    id: "kick", name: "Drum roll + crash", emoji: "🥁", dur: 3.8, tags: ["announce", "goal", "reveal", "result"],
    play: (c, t) => {
      let time = t;
      let gap = 0.15;
      while (time < t + 2.1) {
        noise(c, { at: time, dur: 0.06, gain: 0.45, bandpass: { f: 1100, q: 0.8 } });
        tone(c, { from: 220, to: 90, at: time, dur: 0.07, gain: 0.35 });
        time += gap;
        gap = Math.max(0.04, gap * 0.93);
      }
      noise(c, { at: time, dur: 1.6, gain: 0.6, highpass: 2500 });
      noise(c, { at: time, dur: 0.3, gain: 0.5, bandpass: { f: 900, q: 0.7 } });
      tone(c, { from: 170, to: 45, at: time, dur: 0.45, gain: 0.6, drive: 20 });
    },
  },
  {
    id: "whoosh", name: "Hurricane whoosh", emoji: "🌪️", dur: 3, tags: ["run", "sprint", "bike", "cycle", "cardio", "exercise", "workout", "train"],
    play: (c, t) => {
      noise(c, { at: t, dur: 1.2, gain: 0.5, attack: 0.5, bandpass: { f: [300, 4000], q: 1.2 } });
      noise(c, { at: t + 0.9, dur: 1.2, gain: 0.5, attack: 0.4, bandpass: { f: [4000, 400], q: 1.2 } });
      noise(c, { at: t + 1.7, dur: 1.2, gain: 0.5, attack: 0.5, bandpass: { f: [500, 5000], q: 1.5 } });
      tone(c, { type: "sine", from: 500, to: 1300, at: t + 1.7, dur: 1.1, gain: 0.12, attack: 0.5, vib: { rate: 7, depth: 60 } });
    },
  },
  {
    id: "honk", name: "Clown horn", emoji: "🤡", dur: 2.8, tags: ["silly", "fun", "joke", "laugh"],
    play: (c, t) => {
      [0, 0.4].forEach((d) => tone(c, { type: "sawtooth", from: 330, to: 250, at: t + d, dur: 0.28, gain: 0.5, hold: 0.15, curve: "lin", formants: NASAL, drive: 25 }));
      tone(c, { type: "sawtooth", from: 320, to: 170, at: t + 0.95, dur: 1.6, gain: 0.5, hold: 0.9, curve: "lin", vib: { rate: 9, depth: 14 }, formants: NASAL, drive: 25 });
    },
  },
  {
    id: "quack", name: "Angry duck", emoji: "🦆", dur: 2.8, tags: ["pond", "outside", "walk", "park"],
    play: (c, t) => {
      let time = t;
      while (time < t + 2.4) {
        const p = rnd(360, 470);
        tone(c, { type: "sawtooth", from: p, to: p * 0.6, at: time, dur: 0.17, gain: 0.5, hold: 0.08, curve: "lin", formants: NASAL, drive: 45, trem: { rate: 55, depth: 0.6, type: "square" } });
        time += rnd(0.2, 0.42);
      }
    },
  },
  {
    id: "raspberry", name: "Raspberry", emoji: "😛", dur: 3, tags: ["dont", "don", "never", "junk"],
    play: (c, t) => {
      tone(c, { type: "sawtooth", from: 105, to: 60, at: t, dur: 2.8, gain: 0.5, hold: 2.1, curve: "lin", trem: { rate: [34, 17], depth: 1, type: "square" }, drive: 50, formants: [{ f: 500, q: 2 }, { f: 1300, q: 3, g: 0.8 }] });
      noise(c, { at: t, dur: 2.8, gain: 0.3, hold: 2.1, bandpass: { f: [1500, 600], q: 0.8 }, trem: { rate: [34, 17], depth: 1, type: "square" } });
    },
  },
  {
    id: "sparkle", name: "UFO landing", emoji: "🛸", dur: 4.2, tags: ["space", "weird", "night", "late"],
    play: (c, t) => {
      tone(c, { type: "sine", from: 1300, to: 380, at: t, dur: 4, gain: 0.4, attack: 0.3, hold: 3.2, vib: { rate: 9, depth: 260 } });
      tone(c, { type: "triangle", from: 650, to: 190, at: t, dur: 4, gain: 0.3, attack: 0.3, hold: 3.2, vib: { rate: 13, depth: 120 }, trem: { rate: [6, 18], depth: 0.8 } });
      noise(c, { at: t + 3.2, dur: 0.9, gain: 0.3, bandpass: { f: [3000, 300], q: 2 } });
    },
  },
  {
    id: "woodblock", name: "Woodpecker", emoji: "🪵", dur: 2.8, tags: ["nature", "tree", "forest", "garden"],
    play: (c, t) => {
      let time = t;
      for (let burst = 0; burst < 3; burst++) {
        for (let i = 0; i < 9; i++) {
          noise(c, { at: time, dur: 0.03, gain: 0.6, bandpass: { f: 1500, q: 5 } });
          tone(c, { from: 1500, to: 800, at: time, dur: 0.035, gain: 0.4 });
          time += 0.058;
        }
        time += 0.38;
      }
    },
  },
  {
    id: "cowbell", name: "Elephant", emoji: "🐘", dur: 3.2, tags: ["big", "heavy", "memory", "remember", "revise"],
    play: (c, t) => {
      const blast = (s: number, d: number) => {
        tone(c, { type: "sawtooth", from: 330, to: 760, at: s, dur: d * 0.35, gain: 0.5, attack: 0.04, hold: d * 0.2, formants: [{ f: 900, q: 3 }, { f: 1800, q: 4, g: 0.9 }, { f: 3200, q: 5, g: 0.5 }], drive: 60, vib: { rate: 26, depth: 40, type: "square" } });
        tone(c, { type: "sawtooth", from: 760, to: 420, at: s + d * 0.35, dur: d * 0.65, gain: 0.5, hold: d * 0.3, formants: [{ f: 900, q: 3 }, { f: 1800, q: 4, g: 0.9 }, { f: 3200, q: 5, g: 0.5 }], drive: 60, vib: { rate: 22, depth: 55, type: "square" } });
      };
      blast(t, 1.1);
      blast(t + 1.35, 1.7);
    },
  },
  {
    id: "tada", name: "Ta-da", emoji: "🎉", dur: 4, tags: ["done", "finish", "complete"],
    play: (c, t) => {
      const chord = (s: number, d: number, notes: number[], g: number) => notes.forEach((f) => tone(c, { type: "sawtooth", from: f, at: s, dur: d, gain: g, attack: 0.02, hold: d * 0.5, lowpass: [900, 5000], drive: 10 }));
      chord(t, 0.22, [N.C4, N.E4, N.G4], 0.22);
      chord(t + 0.28, 3.4, [N.C4, N.G4, N.C5, N.E5, N.G5], 0.22);
      noise(c, { at: t + 0.28, dur: 2.2, gain: 0.35, highpass: 4500 });
      let time = t + 1.0;
      while (time < t + 3.4) {
        noise(c, { at: time, dur: 0.04, gain: 0.3, bandpass: { f: rnd(1500, 3000), q: 1.5 } });
        time += rnd(0.04, 0.12);
      }
    },
  },
  {
    id: "fanfare", name: "Royal fanfare", emoji: "🏆", dur: 5, tags: ["champion", "trophy", "best", "first"],
    play: (c, t) => {
      const seq: [number, number][] = [[N.G4, 0.13], [N.G4, 0.13], [N.G4, 0.13], [N.C5, 0.45], [N.E5, 0.13], [N.E5, 0.13], [N.E5, 0.13], [N.G5, 0.45], [N.C6, 0.13], [N.B5, 0.13], [N.A5, 0.13], [N.G5, 0.13], [N.F5, 0.13], [N.E5, 0.13], [N.D5, 0.13], [N.C5, 1.6]];
      melody(c, t, seq, { gain: 0.3, lowpass: [1200, 4500], drive: 15, hold: 0.08 });
      melody(c, t, seq.map(([f, d]) => [f / 2, d] as [number, number]), { gain: 0.2, lowpass: 1500 });
      noise(c, { at: t + 3.3, dur: 1.6, gain: 0.3, highpass: 4000 });
    },
  },
  {
    id: "siren", name: "Police siren", emoji: "🚨", dur: 4, tags: ["police", "ban", "illegal", "rules"],
    play: (c, t) => {
      tone(c, { type: "sawtooth", from: 900, at: t, dur: 3.9, gain: 0.4, hold: 3.6, vib: { rate: 0.85, depth: 330, type: "triangle" }, lowpass: 3500, drive: 20 });
      tone(c, { type: "square", from: 905, at: t, dur: 3.9, gain: 0.15, hold: 3.6, vib: { rate: 0.85, depth: 330, type: "triangle" }, lowpass: 3000 });
    },
  },
  {
    id: "slidewhistle", name: "Slide whistle", emoji: "🎢", dur: 3.2, tags: ["fall", "slip", "up", "down"],
    play: (c, t) => {
      tone(c, { type: "sine", from: 420, to: 1900, at: t, dur: 1.2, gain: 0.5, hold: 0.9, vib: { rate: 6.5, depth: 14 } });
      noise(c, { at: t, dur: 1.2, gain: 0.08, hold: 0.9, bandpass: { f: [800, 3800], q: 6 } });
      tone(c, { type: "sine", from: 1900, to: 300, at: t + 1.3, dur: 1.8, gain: 0.5, hold: 1.3, vib: { rate: 6.5, depth: 14 } });
      noise(c, { at: t + 1.3, dur: 1.8, gain: 0.08, hold: 1.3, bandpass: { f: [3800, 600], q: 6 } });
    },
  },
  {
    id: "bouncyball", name: "Bouncy ball", emoji: "🏀", dur: 3.2, tags: ["basketball", "ball", "sport", "hoop", "dribble", "squash", "tennis", "exercise", "workout", "train"],
    play: (c, t) => {
      let time = t;
      let gap = 0.6;
      for (let i = 0; i < 12 && time < t + 3; i++) {
        tone(c, { from: 420, to: 110, at: time, dur: 0.11, gain: 0.6, drive: 25 });
        noise(c, { at: time, dur: 0.05, gain: 0.4, bandpass: { f: 1800, q: 1 } });
        time += gap;
        gap *= 0.76;
      }
    },
  },
  {
    id: "splat", name: "Fall + splat", emoji: "🍅", dur: 3.2, tags: ["fail", "miss", "oops", "sugar"],
    play: (c, t) => {
      tone(c, { type: "sine", from: 1900, to: 160, at: t, dur: 1.7, gain: 0.45, hold: 1.4, vib: { rate: 8, depth: 25 } });
      noise(c, { at: t + 1.75, dur: 0.55, gain: 0.7, lowpass: [3500, 250], drive: 30 });
      tone(c, { from: 150, to: 40, at: t + 1.75, dur: 0.5, gain: 0.5, drive: 30 });
      for (let i = 0; i < 5; i++) noise(c, { at: t + 2.2 + i * rnd(0.1, 0.2), dur: 0.08, gain: 0.3, bandpass: { f: rnd(500, 1500), q: 3 } });
    },
  },
  {
    id: "modem", name: "Dial-up modem", emoji: "📠", dur: 5, tags: ["phone", "tech", "screen", "internet", "wifi", "social", "insta", "instagram", "tiktok", "scroll", "requests"],
    play: (c, t) => {
      melody(c, t, [[941, 0.1], [1336, 0.1], [697, 0.1], [1209, 0.1], [852, 0.1], [1477, 0.1], [770, 0.1]], { type: "square", gain: 0.3, lowpass: 4000 }, 0.04);
      tone(c, { type: "sine", from: 2100, at: t + 1.1, dur: 0.9, gain: 0.4, hold: 0.7 });
      tone(c, { type: "square", from: 1700, to: 1900, at: t + 2.05, dur: 0.6, gain: 0.3, hold: 0.4, vib: { rate: 31, depth: 260, type: "square" }, lowpass: 5000 });
      noise(c, { at: t + 2.7, dur: 2.2, gain: 0.5, hold: 1.9, bandpass: { f: 2000, q: 0.6 }, trem: { rate: 50, depth: 0.5, type: "square" } });
      tone(c, { type: "sawtooth", from: 500, to: 1100, at: t + 2.7, dur: 2.2, gain: 0.2, hold: 1.9, vib: { rate: 19, depth: 380, type: "sawtooth" } });
    },
  },
  {
    id: "robot", name: "Robot chatter", emoji: "🤖", dur: 3.2, tags: ["code", "computer", "ai", "maths", "further"],
    play: (c, t) => {
      let time = t;
      while (time < t + 2.9) {
        const d = rnd(0.07, 0.26);
        tone(c, { type: pick<OscillatorType>(["square", "sawtooth"]), from: rnd(250, 1900), to: rnd(250, 1900), at: time, dur: d, gain: 0.35, hold: d * 0.6, curve: "lin", vib: { rate: rnd(30, 140), depth: rnd(40, 400), type: "square" }, lowpass: 4500 });
        time += d + rnd(0.01, 0.09);
      }
    },
  },
  {
    id: "meow", name: "Cat meow", emoji: "🐱", dur: 2.8, tags: ["cat", "pet", "cuddle"],
    play: (c, t) => {
      const meow = (s: number, len: number, hi: number) => {
        tone(c, { type: "sawtooth", from: hi * 0.55, to: hi, at: s, dur: len * 0.35, gain: 0.5, attack: 0.05, hold: len * 0.2, formants: EE, vib: { rate: 8, depth: 14 }, drive: 15 });
        tone(c, { type: "sawtooth", from: hi, to: hi * 0.45, at: s + len * 0.35, dur: len * 0.65, gain: 0.5, hold: len * 0.3, formants: AH, vib: { rate: 8, depth: 14 }, drive: 15 });
      };
      meow(t, 1.3, 880);
      meow(t + 1.55, 1.0, 990);
    },
  },
  {
    id: "moo", name: "Cow moo", emoji: "🐮", dur: 3.2, tags: ["milk", "protein", "beef", "steak", "food", "meal", "breakfast", "dinner", "lunch", "eat"],
    play: (c, t) => {
      tone(c, { type: "sawtooth", from: 120, to: 190, at: t, dur: 0.7, gain: 0.55, attack: 0.15, hold: 0.4, formants: OO, vib: { rate: 5, depth: 5 }, drive: 30 });
      tone(c, { type: "sawtooth", from: 190, to: 105, at: t + 0.7, dur: 2.4, gain: 0.55, hold: 1.7, formants: [{ f: 420, q: 4 }, { f: 950, q: 5, g: 0.8 }, { f: 2300, q: 8, g: 0.3 }], vib: { rate: 5.5, depth: 7 }, drive: 30 });
    },
  },
  {
    id: "bark", name: "Dog bark", emoji: "🐶", dur: 2.6, tags: ["dog", "walk", "pet"],
    play: (c, t) => {
      [0, 0.34, 0.95, 1.29, 1.63, 2.1].forEach((d) => {
        noise(c, { at: t + d, dur: 0.26, gain: 0.6, hold: 0.1, bandpass: { f: [1300, 500], q: 1.4 }, drive: 30 });
        tone(c, { type: "sawtooth", from: 440, to: 160, at: t + d, dur: 0.26, gain: 0.55, hold: 0.1, formants: AH, drive: 50 });
      });
    },
  },
  {
    id: "snore", name: "Snore", emoji: "😴", dur: 4.6, tags: ["sleep", "bed", "night", "lights", "wind down", "9pm", "10pm", "11pm", "30pm", "rest", "nap"],
    play: (c, t) => {
      for (let i = 0; i < 4; i++) {
        const s = t + i * 1.12;
        noise(c, { at: s, dur: 0.72, gain: 0.6, attack: 0.3, bandpass: { f: [350, 700], q: 2 }, trem: { rate: 26, depth: 1, type: "square" }, drive: 30 });
        tone(c, { type: "sawtooth", from: 85, to: 120, at: s, dur: 0.72, gain: 0.4, attack: 0.3, trem: { rate: 26, depth: 1, type: "square" }, formants: [{ f: 450, q: 3 }, { f: 1100, q: 4, g: 0.6 }], drive: 50 });
        tone(c, { type: "sine", from: 950, to: 620, at: s + 0.76, dur: 0.32, gain: 0.25, attack: 0.08 });
        noise(c, { at: s + 0.76, dur: 0.32, gain: 0.15, attack: 0.08, bandpass: { f: [2500, 1200], q: 3 } });
      }
    },
  },
  {
    id: "burp", name: "Burp", emoji: "🫢", dur: 2.2, tags: ["eat", "food", "meal", "snack", "fizzy", "drink", "breakfast", "lunch", "dinner"],
    play: (c, t) => {
      tone(c, { type: "sawtooth", from: 170, to: 75, at: t, dur: 1.9, gain: 0.6, hold: 1.2, trem: { rate: [42, 22], depth: 1, type: "square" }, formants: [{ f: 550, q: 3 }, { f: 1250, q: 4, g: 0.8 }, { f: 2400, q: 6, g: 0.3 }], drive: 70 });
      noise(c, { at: t, dur: 1.9, gain: 0.25, hold: 1.2, bandpass: { f: [1200, 500], q: 1 }, trem: { rate: [42, 22], depth: 1, type: "square" } });
    },
  },
  {
    id: "spaceship", name: "Rocket launch", emoji: "🚀", dur: 4.6, tags: ["launch", "start", "go", "morning", "wake", "up"],
    play: (c, t) => {
      noise(c, { at: t, dur: 4.4, gain: 0.6, attack: 1.2, hold: 2.4, bandpass: { f: [250, 3500], q: 0.5 }, drive: 40, trem: { rate: 37, depth: 0.5, type: "sawtooth" } });
      tone(c, { type: "sawtooth", from: 70, to: 1500, at: t, dur: 3.6, gain: 0.35, attack: 0.8, hold: 2.4, drive: 40, lowpass: [600, 5000] });
      for (let i = 0; i < 4; i++) tone(c, { type: "square", from: 1200, at: t + i * 0.22, dur: 0.1, gain: 0.25, hold: 0.06 });
    },
  },
  {
    id: "wahwah", name: "Sad trombone", emoji: "🎺", dur: 3.6, tags: ["missed", "fail", "oops", "late"],
    play: (c, t) => {
      const brass: Partial<ToneOpts> = { type: "sawtooth", gain: 0.5, hold: 0.32, vib: { rate: 5.5, depth: 9 }, lowpass: [2600, 900], drive: 20 };
      melody(c, t, [[466, 0.5], [440, 0.5], [415, 0.5]], brass, 0.08);
      tone(c, { type: "sawtooth", from: 392, to: 280, at: t + 1.8, dur: 1.7, gain: 0.5, hold: 0.7, vib: { rate: 6, depth: 18 }, lowpass: [2600, 600], drive: 20 });
    },
  },
  {
    id: "bells", name: "Steam train", emoji: "🚂", dur: 5, tags: ["travel", "train", "commute", "journey", "school", "bus"],
    play: (c, t) => {
      const horn = (s: number, d: number) => [311, 370, 466].forEach((f) => tone(c, { type: "sawtooth", from: f, at: s, dur: d, gain: 0.3, attack: 0.06, hold: d * 0.75, lowpass: 2200, drive: 25, vib: { rate: 5, depth: 3 } }));
      horn(t, 0.9);
      horn(t + 1.05, 1.5);
      let time = t + 2.5;
      let gap = 0.34;
      while (time < t + 4.8) {
        noise(c, { at: time, dur: gap * 0.7, gain: 0.55, attack: 0.02, bandpass: { f: [1400, 500], q: 0.9 } });
        tone(c, { from: 90, to: 50, at: time, dur: 0.1, gain: 0.35 });
        time += gap;
        gap = Math.max(0.11, gap * 0.9);
      }
    },
  },
  {
    id: "alarm", name: "Alarm clock", emoji: "⏰", dur: 3.2, tags: ["wake", "morning", "alarm", "6am", "7am", "on time", "early"],
    play: (c, t) => {
      for (let g = 0; g < 4; g++) {
        for (let i = 0; i < 4; i++) {
          const s = t + g * 0.78 + i * 0.13;
          tone(c, { type: "square", from: 2050, at: s, dur: 0.08, gain: 0.4, hold: 0.06, lowpass: 6000 });
          tone(c, { type: "square", from: 1025, at: s, dur: 0.08, gain: 0.2, hold: 0.06 });
        }
      }
    },
  },
  {
    id: "kazoo", name: "Kazoo solo", emoji: "🎶", dur: 3.8, tags: ["music", "sing", "guitar", "practice", "instrument", "song"],
    play: (c, t) => {
      melody(c, t, [[N.E5, 0.3], [N.D5, 0.3], [N.C5, 0.3], [N.D5, 0.3], [N.E5, 0.3], [N.E5, 0.3], [N.E5, 0.6], [N.D5, 0.3], [N.D5, 0.3], [N.D5, 0.55]], { type: "sawtooth", gain: 0.5, hold: 0.18, trem: { rate: 95, depth: 0.7, type: "square" }, formants: NASAL, drive: 60, lowpass: 5000 }, 0.03);
    },
  },
  {
    id: "chicken", name: "Chicken", emoji: "🐔", dur: 3.2, tags: ["chicken", "egg", "breakfast", "protein", "food"],
    play: (c, t) => {
      let time = t;
      for (let i = 0; i < 6; i++) {
        tone(c, { type: "sawtooth", from: rnd(750, 950), to: 480, at: time, dur: 0.09, gain: 0.5, formants: NASAL, drive: 40 });
        time += rnd(0.15, 0.28);
      }
      tone(c, { type: "sawtooth", from: 600, to: 1250, at: time, dur: 0.3, gain: 0.5, formants: NASAL, drive: 40, vib: { rate: 14, depth: 50 } });
      tone(c, { type: "sawtooth", from: 1250, to: 380, at: time + 0.3, dur: 1.0, gain: 0.5, hold: 0.5, formants: NASAL, drive: 40, vib: { rate: 14, depth: 50 } });
    },
  },
  {
    id: "cuckoo", name: "Monkey", emoji: "🐒", dur: 3.4, tags: ["play", "mess", "fun", "climb", "jungle"],
    play: (c, t) => {
      let time = t;
      let gap = 0.34;
      for (let i = 0; i < 5; i++) {
        tone(c, { type: "sawtooth", from: 300 + i * 25, to: 420 + i * 30, at: time, dur: 0.2, gain: 0.5, hold: 0.1, formants: OO, drive: 25 });
        time += gap;
        gap *= 0.9;
      }
      for (let i = 0; i < 7 && time < t + 3.1; i++) {
        tone(c, { type: "sawtooth", from: 620 + i * 45, to: 900 + i * 50, at: time, dur: 0.16, gain: 0.55, hold: 0.09, formants: AH, drive: 50 });
        time += 0.2;
      }
    },
  },
  {
    id: "applause", name: "Applause", emoji: "👏", dur: 4, tags: ["perform", "present", "speech", "show"],
    play: (c, t) => {
      let time = t;
      let density = 0.045;
      while (time < t + 3.8) {
        noise(c, { at: time, dur: rnd(0.03, 0.07), gain: rnd(0.3, 0.6), bandpass: { f: rnd(1100, 2800), q: 1.6 } });
        time += density * rnd(0.5, 1.5);
        if (time > t + 2.5) density += 0.006;
      }
      tone(c, { type: "sawtooth", from: 700, to: 1100, at: t + 0.6, dur: 0.5, gain: 0.12, attack: 0.2, formants: AH, vib: { rate: 7, depth: 30 } });
    },
  },
  {
    id: "typewriter", name: "Typewriter", emoji: "⌨️", dur: 3.6, tags: ["study", "essay", "write", "homework", "notes", "journal", "read", "reading", "economics", "physics"],
    play: (c, t) => {
      let time = t;
      while (time < t + 2.4) {
        noise(c, { at: time, dur: 0.04, gain: 0.6, highpass: 2200 });
        tone(c, { from: 260, to: 130, at: time, dur: 0.03, gain: 0.35 });
        time += rnd(0.08, 0.2);
      }
      tone(c, { type: "square", from: 2400, at: time, dur: 0.5, gain: 0.3, vib: { rate: 180, depth: 500 } });
      noise(c, { at: time + 0.35, dur: 0.7, gain: 0.45, attack: 0.05, bandpass: { f: [2500, 500], q: 1.5 }, trem: { rate: 45, depth: 0.8, type: "sawtooth" } });
    },
  },
  {
    id: "wave", name: "Wave crash", emoji: "🌊", dur: 5, tags: ["sea", "beach", "surf", "swim", "cold", "shower", "ocean"],
    play: (c, t) => {
      noise(c, { at: t, dur: 2.0, gain: 0.35, attack: 1.7, lowpass: [300, 2500] });
      noise(c, { at: t + 1.7, dur: 1.4, gain: 0.8, attack: 0.12, hold: 0.25, highpass: [200, 900], drive: 25 });
      tone(c, { from: 80, to: 35, at: t + 1.75, dur: 0.9, gain: 0.5, drive: 30 });
      noise(c, { at: t + 2.4, dur: 2.6, gain: 0.4, attack: 0.3, hold: 0.4, highpass: [1500, 4500] });
      for (let i = 0; i < 9; i++) tone(c, { from: rnd(500, 1400), to: rnd(1500, 2600), at: t + 2.8 + i * rnd(0.12, 0.22), dur: 0.07, gain: 0.12 });
    },
  },
  {
    id: "birds", name: "Morning birds", emoji: "🐦", dur: 4, tags: ["sun", "sunlight", "light", "outside", "morning", "walk", "nature"],
    play: (c, t) => {
      let time = t;
      while (time < t + 3.7) {
        const base = rnd(2200, 3600);
        const trill = Math.random() < 0.4;
        if (trill) tone(c, { from: base, at: time, dur: 0.35, gain: 0.4, hold: 0.25, vib: { rate: 28, depth: 500 }, trem: { rate: 28, depth: 0.9 } });
        else {
          tone(c, { from: base, to: base * rnd(1.25, 1.6), at: time, dur: 0.09, gain: 0.4 });
          tone(c, { from: base * 1.5, to: base * 0.85, at: time + 0.1, dur: 0.13, gain: 0.4 });
        }
        time += rnd(0.18, 0.5);
      }
    },
  },
  {
    id: "thunder", name: "Thunderstorm", emoji: "⛈️", dur: 4.6, tags: ["power", "heavy", "strength", "storm", "rain"],
    play: (c, t) => {
      noise(c, { at: t, dur: 0.3, gain: 0.9, highpass: 1200, drive: 40 });
      for (let i = 0; i < 7; i++) noise(c, { at: t + 0.15 + i * rnd(0.08, 0.2), dur: rnd(0.1, 0.25), gain: rnd(0.4, 0.7), bandpass: { f: rnd(500, 1800), q: 0.7 }, drive: 40 });
      noise(c, { at: t + 0.2, dur: 4.2, gain: 0.7, attack: 0.05, hold: 1.6, lowpass: [900, 120], drive: 50 });
      noise(c, { at: t + 0.5, dur: 4, gain: 0.12, hold: 3.4, highpass: 5000 });
    },
  },
  {
    id: "gameover", name: "Game over", emoji: "🎮", dur: 3.2, tags: ["game", "gaming", "video", "console", "xbox", "playstation", "fortnite"],
    play: (c, t) => {
      melody(c, t, [[N.C5, 0.17], [N.B4, 0.17], [N.A4, 0.17], [N.G4, 0.17], [N.F4, 0.17], [N.E4, 0.17], [N.D4, 0.35]], { type: "square", gain: 0.4, hold: 0.1, lowpass: 3000 }, 0.03);
      tone(c, { type: "square", from: N.C4, to: N.C4 / 4, at: t + 1.65, dur: 1.4, gain: 0.4, hold: 0.6, lowpass: 2500, vib: { rate: 14, depth: 25 } });
      noise(c, { at: t + 1.65, dur: 1.4, gain: 0.15, hold: 0.6, lowpass: [3000, 300], trem: { rate: 20, depth: 1, type: "square" } });
    },
  },
  {
    id: "powerup", name: "Bass drop", emoji: "🔊", dur: 4.6, tags: ["energy", "boost", "push", "press", "gym", "workout", "exercise", "train"],
    play: (c, t) => {
      noise(c, { at: t, dur: 1.5, gain: 0.4, attack: 1.3, bandpass: { f: [400, 7000], q: 2 } });
      tone(c, { type: "sawtooth", from: 200, to: 2400, at: t, dur: 1.5, gain: 0.3, attack: 1.2, lowpass: 6000 });
      for (let i = 0; i < 12; i++) tone(c, { type: "square", from: 900, at: t + 0.4 + i * (1.1 / 12) * (1 - i * 0.02), dur: 0.04, gain: 0.2 });
      const wob = (s: number, d: number, rate: number, f: number) => tone(c, { type: "sawtooth", from: f, at: s, dur: d, gain: 0.6, attack: 0.01, hold: d * 0.85, trem: { rate, depth: 1 }, drive: 80, formants: [{ f: 250, q: 1.5 }, { f: 800, q: 2, g: 0.9 }, { f: 1900, q: 3, g: 0.5 }] });
      wob(t + 1.65, 0.75, 6, 55);
      wob(t + 2.4, 0.75, 12, 55);
      wob(t + 3.15, 0.4, 6, 65);
      wob(t + 3.55, 0.9, 18, 49);
      noise(c, { at: t + 1.65, dur: 0.5, gain: 0.5, highpass: 3000 });
    },
  },
  {
    id: "victory", name: "Victory jingle", emoji: "🥇", dur: 4, tags: ["match", "score", "beat", "win"],
    play: (c, t) => {
      const seq: [number, number][] = [[N.C5, 0.15], [N.E5, 0.15], [N.G5, 0.15], [N.C6, 0.3], [N.G5, 0.15], [N.C6, 0.7]];
      melody(c, t, seq, { type: "square", gain: 0.35, hold: 0.08, lowpass: 4000 }, 0.03);
      melody(c, t, seq.map(([f, d]) => [f / 2, d] as [number, number]), { gain: 0.3, lowpass: 1800 }, 0.03);
      melody(c, t + 1.9, [[N.E6, 0.12], [N.G6, 0.12], [N.C7, 1.5]], { type: "square", gain: 0.3, hold: 0.1, lowpass: 5000, vib: { rate: 7, depth: 12 } }, 0.03);
      noise(c, { at: t + 2.15, dur: 1.6, gain: 0.3, highpass: 5000 });
    },
  },
  {
    id: "howl", name: "Wolf howl", emoji: "🐺", dur: 3.8, tags: ["moon", "dark", "pack", "friends", "mates"],
    play: (c, t) => {
      tone(c, { type: "sawtooth", from: 260, to: 760, at: t, dur: 1.2, gain: 0.5, attack: 0.2, hold: 0.9, formants: OO, vib: { rate: 5, depth: 6 }, drive: 15 });
      tone(c, { type: "sawtooth", from: 760, to: 730, at: t + 1.2, dur: 1.1, gain: 0.5, hold: 0.9, curve: "lin", formants: OO, vib: { rate: 6, depth: 14 }, drive: 15 });
      tone(c, { type: "sawtooth", from: 730, to: 300, at: t + 2.3, dur: 1.4, gain: 0.5, hold: 0.5, formants: OO, vib: { rate: 6, depth: 14 }, drive: 15 });
    },
  },
  {
    id: "doorbell", name: "Evil laugh", emoji: "😈", dur: 4.6, tags: ["evil", "plan", "revenge", "comeback", "prove"],
    play: (c, t) => {
      tone(c, { type: "sawtooth", from: 110, to: 140, at: t, dur: 0.5, gain: 0.5, attack: 0.1, hold: 0.3, formants: [{ f: 300, q: 4 }, { f: 1000, q: 5, g: 0.6 }], drive: 40 });
      let time = t + 0.6;
      let gap = 0.24;
      let p = 230;
      for (let i = 0; i < 9 && time < t + 3.1; i++) {
        noise(c, { at: time, dur: 0.05, gain: 0.25, bandpass: { f: 2200, q: 1 } });
        tone(c, { type: "sawtooth", from: p * 1.1, to: p * 0.85, at: time + 0.02, dur: gap * 0.7, gain: 0.55, hold: gap * 0.3, formants: AH, drive: 50 });
        time += gap;
        gap *= 1.07;
        p *= 0.94;
      }
      tone(c, { type: "sawtooth", from: p, to: p * 0.6, at: time, dur: 0.9, gain: 0.55, hold: 0.4, formants: AH, drive: 50, vib: { rate: 7, depth: 10 } });
    },
  },
  {
    id: "telephone", name: "Old phone ring", emoji: "☎️", dur: 4, tags: ["call", "mum", "dad", "family", "gran"],
    play: (c, t) => {
      [0, 2.0].forEach((d) => {
        tone(c, { type: "square", from: 1100, at: t + d, dur: 1.3, gain: 0.35, hold: 1.1, vib: { rate: 210, depth: 600 }, trem: { rate: 21, depth: 1, type: "square" }, highpass: 800 });
        tone(c, { type: "square", from: 1480, at: t + d, dur: 1.3, gain: 0.3, hold: 1.1, vib: { rate: 170, depth: 500 }, trem: { rate: 21, depth: 1, type: "square" }, highpass: 800 });
      });
    },
  },
  {
    id: "gallop", name: "Horse", emoji: "🐎", dur: 4.2, tags: ["run", "jog", "race", "exercise", "workout", "train"],
    play: (c, t) => {
      tone(c, { type: "sawtooth", from: 900, to: 1700, at: t, dur: 0.35, gain: 0.5, formants: NASAL, vib: { rate: 17, depth: 110 }, drive: 30 });
      tone(c, { type: "sawtooth", from: 1700, to: 450, at: t + 0.35, dur: 1.1, gain: 0.5, hold: 0.5, formants: NASAL, vib: { rate: 17, depth: 110 }, drive: 30 });
      let time = t + 1.6;
      while (time < t + 4) {
        [0, 0.11, 0.2].forEach((d, j) => {
          noise(c, { at: time + d, dur: 0.06, gain: 0.55, bandpass: { f: j === 2 ? 1500 : 1000, q: 2 } });
          tone(c, { from: 200, to: 70, at: time + d, dur: 0.07, gain: 0.4 });
        });
        time += 0.5;
      }
    },
  },
  {
    id: "helicopter", name: "Helicopter", emoji: "🚁", dur: 4.2, tags: ["fly", "trip", "holiday", "air"],
    play: (c, t) => {
      noise(c, { at: t, dur: 4, gain: 0.7, attack: 0.8, hold: 2.4, bandpass: { f: [500, 1100], q: 0.8 }, trem: { rate: [7, 15], depth: 1, type: "sawtooth" }, drive: 30 });
      tone(c, { type: "sawtooth", from: 95, to: 140, at: t, dur: 4, gain: 0.3, attack: 0.8, hold: 2.4, trem: { rate: [7, 15], depth: 1, type: "sawtooth" }, drive: 40, formants: [{ f: 400, q: 2 }, { f: 1200, q: 3, g: 0.5 }] });
      tone(c, { type: "sine", from: 2200, to: 2600, at: t, dur: 4, gain: 0.06, attack: 0.8, hold: 2.4 });
    },
  },
  {
    id: "airhorn", name: "Air horn", emoji: "📣", dur: 3.2, tags: ["hype", "party", "goal", "max", "pb", "exercise", "workout"],
    play: (c, t) => {
      [0, 0.32, 0.64].forEach((d, i) => {
        const dur = i === 2 ? 2.4 : 0.26;
        [[233, 0.4], [349, 0.35], [466, 0.2]].forEach(([f, g]) => tone(c, { type: "sawtooth", from: f * 0.94, to: f, at: t + d, dur, gain: g, attack: 0.02, hold: dur * 0.8, curve: "lin", drive: 60, lowpass: 4500, vib: { rate: 5, depth: 2 } }));
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

/* ---------- rendering, loudness matching and playback ---------- */

const RENDER_RATE = 44100;
/** Every sound is normalised to this short-term loudness, then soft-limited. Higher = louder. */
const TARGET_RMS = 0.3;

let ctx: AudioContext | null = null;
let unlocked = false;
const cache = new Map<string, AudioBuffer>();
const rendering = new Map<string, Promise<AudioBuffer | null>>();

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
  if (!unlocked) {
    // iOS only lets audio start inside a tap: play one silent sample now so later (async) playback is allowed.
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

/**
 * How loud a clip sounds: the loudest 300 ms stretch. Measured twice: high-passed (what a phone speaker can
 * actually reproduce) and full-band (what real speakers play), taking whichever is louder.
 */
export function loudnessOf(data: Float32Array, sampleRate: number): { loudness: number; peak: number } {
  const n = data.length;
  const rc = 1 / (2 * Math.PI * 250);
  const alpha = rc / (rc + 1 / sampleRate);
  const win = Math.max(1, Math.floor(sampleRate * 0.3));
  const hop = Math.max(1, Math.floor(win / 3));
  const hp = new Float32Array(n);
  let prevX = 0;
  let prevY = 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const x = data[i];
    const y = alpha * (prevY + x - prevX);
    prevX = x;
    prevY = y;
    hp[i] = y * y;
    const a = Math.abs(x);
    if (a > peak) peak = a;
  }
  let maxHp = 0;
  let maxFull = 0;
  for (let start = 0; start < n; start += hop) {
    const end = Math.min(n, start + win);
    let sumHp = 0;
    let sumFull = 0;
    for (let i = start; i < end; i++) {
      sumHp += hp[i];
      sumFull += data[i] * data[i];
    }
    if (sumHp / win > maxHp) maxHp = sumHp / win;
    if (sumFull / win > maxFull) maxFull = sumFull / win;
  }
  // Bass counts a bit less than mids, but enough that a rumble can't blow out decent speakers.
  return { loudness: Math.max(Math.sqrt(maxHp), Math.sqrt(maxFull) / 1.25), peak };
}

/**
 * Bring `data` to the target loudness, measured AFTER the tanh soft limiter, so spiky sounds (a bark) and
 * smooth ones (a siren) really do come out equal. A few passes are enough to converge.
 */
export function normalizeSamples(data: Float32Array, sampleRate: number, target = TARGET_RMS): void {
  const n = data.length;
  if (!n) return;
  const first = loudnessOf(data, sampleRate);
  if (first.peak < 1e-5 || first.loudness < 1e-7) return;
  const maxGain = 14 / first.peak; // beyond this the limiter is flat-lining and more gain adds nothing
  let gain = Math.min(target / first.loudness, maxGain);
  const work = new Float32Array(n);
  for (let pass = 0; pass < 5; pass++) {
    for (let i = 0; i < n; i++) work[i] = Math.tanh(data[i] * gain);
    const got = loudnessOf(work, sampleRate).loudness;
    const ratio = target / got;
    if (Math.abs(ratio - 1) < 0.02 || gain >= maxGain) break;
    gain = Math.min(gain * ratio, maxGain);
  }
  for (let i = 0; i < n; i++) data[i] = Math.tanh(data[i] * gain);
  // Short fade-out so a render that ends mid-wave doesn't click.
  const fade = Math.min(n, Math.floor(sampleRate * 0.03));
  for (let i = 0; i < fade; i++) data[n - 1 - i] *= i / fade;
}

function renderSound(id: string): Promise<AudioBuffer | null> {
  const running = rendering.get(id);
  if (running) return running;
  const job = (async () => {
    try {
      const OAC = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
      if (!OAC) return null;
      const s = soundById(id);
      const off = new OAC(1, Math.ceil((s.dur + 0.4) * RENDER_RATE), RENDER_RATE);
      s.play(off, 0.02);
      const buf = await new Promise<AudioBuffer>((resolve, reject) => {
        off.oncomplete = (e) => resolve(e.renderedBuffer);
        const p = off.startRendering();
        if (p && typeof p.then === "function") p.then(resolve, reject);
      });
      normalizeSamples(buf.getChannelData(0), RENDER_RATE);
      cache.set(id, buf);
      return buf;
    } catch {
      return null;
    } finally {
      rendering.delete(id);
    }
  })();
  rendering.set(id, job);
  return job;
}

function startBuffer(c: AudioContext, buf: AudioBuffer) {
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start();
}

export function playSound(id: string | undefined): void {
  const c = getCtx(); // must happen synchronously inside the tap
  if (!c) return;
  const key = soundById(id).id;
  const ready = cache.get(key);
  if (ready) {
    startBuffer(c, ready);
    // Many sounds are randomised: render a fresh take for next time.
    window.setTimeout(() => void renderSound(key), 50);
    return;
  }
  void renderSound(key).then((buf) => {
    if (buf) startBuffer(c, buf);
  });
}

/** Render these in the background so the first tap is instant. */
export function prewarmSounds(ids: (string | undefined)[]): void {
  if (typeof window === "undefined") return;
  const todo = [...new Set(ids.map((i) => soundById(i).id))].filter((i) => !cache.has(i));
  const next = () => {
    const id = todo.shift();
    if (!id) return;
    void renderSound(id).then(() => window.setTimeout(next, 30));
  };
  window.setTimeout(next, 400);
}

/** Dev / test hook: render one sound and report its measured loudness after normalisation. */
export async function measureSound(id: string): Promise<{ id: string; rms: number; peak: number } | null> {
  const buf = await renderSound(id);
  if (!buf) return null;
  const m = loudnessOf(buf.getChannelData(0), RENDER_RATE);
  return { id, rms: m.loudness, peak: m.peak };
}

/** A random sound, leaning towards ones whose tags match the habit's name, avoiding ones already in use. */
export function pickSoundForHabit(name: string, used: (string | undefined)[] = []): string {
  const n = name.toLowerCase();
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  // A tag matches at the start of a word ("sleep" → "sleeping") but not inside one ("fast" ≠ "breakfast").
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
  return pick(SOUNDS.filter((s) => s.id !== exclude)).id;
}

export function haptic(pattern: number | number[] = 12): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

// Dev only: lets the loudness of every sound be measured from the browser console.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as Record<string, unknown>).__lockedInSounds = { SOUNDS, measureSound, playSound };
}
