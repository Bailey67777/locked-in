// Builds the fifty habit sounds into public/sounds/*.mp3 and writes src/lib/sound-list.ts.
// Run on a Mac: node scripts/make-sounds.mjs            (needs `say` and `ffmpeg`)
//
// Nothing here is downloaded or sampled from anyone's recording:
//   - voices (teachers, goats that talk, the singing ones) are spoken by macOS's built-in `say` voices,
//   - every tune is a public-domain melody, written out below as notes and played on a synth made in this file,
//   - whistles, goats, kazoos, horns and the rest are synthesised here from scratch.
// The 50 ids never change (saved habits point at them); what each one sounds like can.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SR = 44100;
const TAU = Math.PI * 2;
const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "sounds");
const TMP = path.join(tmpdir(), "locked-in-sounds");
const VERSION = "3";
const MAX_SECONDS = 4.8;

/* ---------- small DSP toolkit ---------- */

let seed = 20261011;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rnd = (a, b) => a + rand() * (b - a);
const sec = (s) => Math.max(1, Math.round(s * SR));
const buf = (s) => new Float32Array(sec(s));
const fn = (v) => (typeof v === "function" ? v : () => v);

function osc(shape, freq, dur, { duty = 0.5, phase = 0 } = {}) {
  const n = sec(dur);
  const out = new Float32Array(n);
  const f = fn(freq);
  let ph = phase;
  for (let i = 0; i < n; i++) {
    ph += f(i / SR) / SR;
    ph -= Math.floor(ph);
    out[i] = shape === "sine" ? Math.sin(TAU * ph) : shape === "saw" ? 2 * ph - 1 : shape === "tri" ? 1 - 4 * Math.abs(ph - 0.5) : ph < duty ? 1 : -1;
  }
  return out;
}

function noise(dur) {
  const out = buf(dur);
  for (let i = 0; i < out.length; i++) out[i] = rand() * 2 - 1;
  return out;
}

/** RBJ biquad. `freq` may be a function of time (seconds). */
function biquad(x, type, freq, q = 0.707) {
  const f = fn(freq);
  const out = new Float32Array(x.length);
  let b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  const set = (hz) => {
    const w = (TAU * Math.min(SR * 0.45, Math.max(20, hz))) / SR;
    const cs = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    let a0;
    if (type === "lowpass") [b0, b1, b2, a0, a1, a2] = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2, 1 + al, -2 * cs, 1 - al];
    else if (type === "highpass") [b0, b1, b2, a0, a1, a2] = [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2, 1 + al, -2 * cs, 1 - al];
    else [b0, b1, b2, a0, a1, a2] = [al, 0, -al, 1 + al, -2 * cs, 1 - al]; // bandpass, 0 dB peak
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  };
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const varying = typeof freq === "function";
  set(f(0));
  for (let i = 0; i < x.length; i++) {
    if (varying && i % 32 === 0) set(f(i / SR));
    const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

/** Parallel band-passes: gives a throat / vowel / horn quality. bands: [freq, q, gain] */
function formant(x, bands) {
  const out = new Float32Array(x.length);
  for (const [f, q, g = 1] of bands) {
    const y = biquad(x, "bandpass", f, q);
    for (let i = 0; i < out.length; i++) out[i] += y[i] * g;
  }
  return out;
}

function adsr(x, { a = 0.01, d = 0.04, s = 0.85, r = 0.05 } = {}) {
  const T = x.length / SR;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    let g = t < a ? t / a : t < a + d ? 1 - ((1 - s) * (t - a)) / d : s;
    const left = T - t;
    if (left < r) g *= left / r;
    x[i] *= g;
  }
  return x;
}

const map = (x, f) => {
  for (let i = 0; i < x.length; i++) x[i] = f(x[i], i / SR, i);
  return x;
};
const gain = (x, g) => map(x, (v) => v * g);
const drive = (x, k) => map(x, (v) => Math.tanh(v * k));
const peakOf = (x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const norm = (x, peak = 0.9) => {
  const p = peakOf(x);
  return p > 1e-9 ? gain(x, peak / p) : x;
};

function mixInto(dst, src, at = 0, g = 1) {
  const o = Math.round(at * SR);
  for (let i = 0; i < src.length && o + i < dst.length; i++) if (o + i >= 0) dst[o + i] += src[i] * g;
  return dst;
}

/** Layer clips: [clip, startSeconds, gain]. */
function mix(...layers) {
  const end = Math.max(...layers.map(([x, at = 0]) => Math.round(at * SR) + x.length));
  const out = new Float32Array(end);
  for (const [x, at = 0, g = 1] of layers) mixInto(out, x, at, g);
  return out;
}

/** Clips one after another; numbers are gaps in seconds. */
function chain(...parts) {
  const layers = [];
  let t = 0;
  for (const p of parts) {
    if (typeof p === "number") t += p;
    else {
      layers.push([p, t, 1]);
      t += p.length / SR;
    }
  }
  return mix(...layers);
}

/** Play back faster/slower by resampling: ratio > 1 is higher and shorter (helium), < 1 lower and longer. */
function speed(x, ratio) {
  const n = Math.floor(x.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * ratio;
    const k = Math.floor(p);
    const frac = p - k;
    out[i] = (x[k] ?? 0) * (1 - frac) + (x[k + 1] ?? 0) * frac;
  }
  return out;
}

function echo(x, delay, feedback = 0.35, wet = 0.5, tail = 0.6) {
  const out = new Float32Array(x.length + sec(tail));
  out.set(x);
  const d = sec(delay);
  for (let i = d; i < out.length; i++) out[i] += out[i - d] * feedback * wet + (x[i - d] ?? 0) * wet * (1 - feedback);
  return out;
}

/** A bare classroom / school hall: a handful of early reflections plus a short tail. */
function hall(x, amount = 0.35) {
  let out = new Float32Array(x.length + sec(0.5));
  out.set(x);
  for (const [d, g] of [[0.023, 0.5], [0.037, 0.4], [0.059, 0.33], [0.083, 0.27], [0.113, 0.2]]) mixInto(out, x, d, g * amount);
  out = echo(out, 0.149, 0.4, amount * 0.6, 0.2);
  return out;
}

/** School tannoy: thin, a bit crunchy, slapping back off the far wall. */
function tannoy(x) {
  let y = biquad(biquad(x, "highpass", 520, 0.8), "lowpass", 2700, 0.8);
  y = drive(norm(y, 1), 2.2);
  return echo(y, 0.12, 0.3, 0.45, 0.5);
}

function trim(x, threshold = 0.006, pad = 0.012) {
  let a = 0;
  let b = x.length - 1;
  while (a < b && Math.abs(x[a]) < threshold) a++;
  while (b > a && Math.abs(x[b]) < threshold) b--;
  const p = sec(pad);
  return x.slice(Math.max(0, a - p), Math.min(x.length, b + p));
}

/* ---------- notes and tunes ---------- */

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function hz(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  const midi = SEMI[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + (Number(m[3]) + 1) * 12;
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * Play a score on an instrument. Score: "G4/1 E5/0.5 -/1", note/beats, "-" is a rest, "C4+E4+G4/2" is a chord.
 * voice(freq, seconds, index, previousFreq) returns samples.
 */
function tune(score, beat, voice, { legato = 0.9, transpose = 0 } = {}) {
  const items = score.trim().split(/\s+/).map((tok) => {
    const [n, b = "1"] = tok.split("/");
    return { n, beats: Number(b) };
  });
  const total = items.reduce((s, i) => s + i.beats, 0) * beat;
  const out = buf(total + 1.2);
  let t = 0;
  let idx = 0;
  let prev = null;
  for (const it of items) {
    const d = it.beats * beat;
    if (it.n !== "-") {
      for (const name of it.n.split("+")) {
        const f = hz(name) * 2 ** (transpose / 12);
        mixInto(out, voice(f, Math.max(0.03, d * legato), idx, prev), t);
        prev = f;
      }
      idx++;
    } else prev = null;
    t += d;
  }
  return trim(out, 0.0005, 0.01);
}

/* ---------- instruments ---------- */

function kazoo(f, d) {
  const v = (t) => f * (1 + 0.014 * Math.sin(TAU * 5.6 * t) * Math.min(1, t / 0.12)) * (t < 0.03 ? 0.955 + (0.045 * t) / 0.03 : 1);
  const a = osc("saw", v, d);
  const b = osc("pulse", v, d, { duty: 0.42 });
  let x = map(a, (s, t, i) => Math.tanh((s * 0.7 + b[i] * 0.5) * 3));
  x = formant(x, [[650, 3, 0.55], [1250, 4, 1], [2500, 5, 0.9], [3600, 6, 0.4]]);
  const rattle = biquad(noise(d), "bandpass", 2800, 1.2);
  map(x, (s, t, i) => s + rattle[i] * 0.25 * Math.abs(s));
  return adsr(norm(x, 0.9), { a: 0.018, d: 0.04, s: 0.88, r: 0.035 });
}

/** A person whistling: nearly a pure tone, a little breath, vibrato that creeps in, a scoop into each note. */
function whistle(f, d, _i, prev) {
  const from = prev ?? f * 0.93;
  const glide = 0.05;
  const v = (t) => {
    const base = t < glide ? from + (f - from) * (t / glide) : f;
    const vib = Math.min(1, Math.max(0, (t - 0.12) / 0.2));
    return base * (1 + 0.012 * vib * Math.sin(TAU * 5.8 * t));
  };
  const a = osc("sine", v, d);
  const b = osc("sine", (t) => 2 * v(t), d);
  const breath = norm(biquad(noise(d), "bandpass", v, 9), 0.22);
  const air = norm(biquad(noise(d), "highpass", 5000, 0.7), 0.03);
  const out = map(a, (s, t, i) => s + 0.06 * b[i] + breath[i] + air[i]);
  return adsr(out, { a: 0.035, d: 0.03, s: 0.9, r: 0.05 });
}

/** A goat. Sawtooth "voice", a fast bleat wobble, a nasal "m" opening into "ehh". scream = the famous yelling kind. */
function goat(f0, d, { scream = false } = {}) {
  const wob = rnd(11, 16);
  const drift = rnd(0.7, 1.6); // the wobble itself speeds up and slows down, so it never sounds like a machine
  const phase = (t) => TAU * wob * t + 1.4 * Math.sin(TAU * drift * t);
  const breakAt = scream ? rnd(0.35, 0.5) : 2;
  const pitch = (t) => {
    const u = t / d;
    const contour = u < 0.1 ? 0.84 + (0.16 * u) / 0.1 : u > 0.72 ? 1 - 0.2 * ((u - 0.72) / 0.28) : 1;
    const crack = u > breakAt ? 1.34 : 1; // voice breaks upwards, like a teenager / a yelling goat
    return f0 * contour * crack * (1 + (scream ? 0.02 : 0.035) * Math.sin(phase(t)));
  };
  const a = osc("saw", pitch, d);
  const sub = osc("pulse", (t) => pitch(t) / 2, d, { duty: 0.3 });
  const grit = biquad(noise(d), "bandpass", 1800, 0.8);
  let src = map(a, (s, t, i) => Math.tanh((s * 0.8 + sub[i] * (scream ? 0.5 : 0.28) + grit[i] * (scream ? 0.5 : 0.15)) * (scream ? 4 : 2.6)));
  // the "eh-eh-eh-eh" of a bleat
  map(src, (s, t) => s * (scream ? 0.85 + 0.15 * Math.sin(TAU * wob * 2.3 * t) : 0.52 + 0.48 * Math.sin(phase(t) + 1.3)));
  const open = scream ? formant(src, [[820, 4, 1], [1250, 5, 0.9], [2700, 6, 0.6], [3500, 7, 0.3]]) : formant(src, [[620, 5, 0.6], [1700, 6, 1.2], [2500, 7, 0.8], [3400, 8, 0.3]]);
  const nasal = formant(src, [[280, 3, 1], [1050, 5, 0.25]]);
  const m = scream ? 0.03 : 0.09;
  const out = map(open, (s, t, i) => {
    const k = Math.min(1, Math.max(0, (t - m * 0.6) / (m * 0.6)));
    return s * k + nasal[i] * (1 - k) * 1.4;
  });
  return adsr(norm(out, 0.9), { a: 0.03, d: 0.05, s: 0.9, r: scream ? 0.08 : 0.12 });
}

function choir(f, d) {
  const out = buf(d);
  [-7, 0, 6].forEach((cents, k) => {
    const ff = f * 2 ** (cents / 1200);
    const x = osc("saw", (t) => ff * (1 + 0.006 * Math.sin(TAU * (4.8 + k * 0.5) * t + k)), d, { phase: k * 0.31 });
    for (let i = 0; i < out.length; i++) out[i] += x[i] / 3;
  });
  let y = formant(out, [[700, 4, 1], [1100, 5, 0.7], [2600, 7, 0.35], [3300, 8, 0.2]]);
  y = biquad(y, "lowpass", 4500, 0.7);
  return adsr(norm(y, 0.9), { a: 0.06, d: 0.05, s: 0.9, r: 0.1 });
}

function brass(f, d, _i, _p, bright = 1) {
  const x = osc("saw", (t) => f * (1 + 0.004 * Math.sin(TAU * 5 * t) * Math.min(1, t / 0.3)), d);
  const cut = (t) => 320 + 2400 * bright * Math.min(1, t / 0.07) * (0.55 + 0.45 * Math.max(0, Math.min(1, (d - t) / 0.1)));
  return adsr(norm(biquad(x, "lowpass", cut, 1.3), 0.9), { a: 0.03, d: 0.08, s: 0.85, r: 0.07 });
}

function organ(f, d) {
  const out = buf(d);
  for (const [h, g] of [[0.5, 0.45], [1, 1], [2, 0.6], [3, 0.3], [4, 0.4], [6, 0.15], [8, 0.2]]) {
    const x = osc("sine", f * h, d, { phase: rand() });
    for (let i = 0; i < out.length; i++) out[i] += x[i] * g;
  }
  const chiff = norm(biquad(noise(Math.min(d, 0.04)), "bandpass", f * 2, 2), 0.25);
  mixInto(out, adsr(chiff, { a: 0.002, r: 0.03, s: 1 }), 0);
  return adsr(norm(out, 0.9), { a: 0.014, d: 0.02, s: 0.95, r: 0.07 });
}

/** An out-of-tune upright: two strings per note a few cents apart, fast decay. */
function honkyTonk(f, d) {
  const n = sec(Math.max(d, 0.2) + 0.45);
  const out = new Float32Array(n);
  for (const cents of [-9, 7]) {
    const ff = f * 2 ** (cents / 1200);
    for (let k = 1; k <= 7; k++) {
      const pf = k * ff * Math.sqrt(1 + 0.0004 * k * k);
      if (pf > SR * 0.45) break;
      const tau = (0.7 / (1 + 0.3 * k)) * (330 / f) ** 0.25;
      const ph = rand() * TAU;
      for (let i = 0; i < n; i++) out[i] += (Math.sin(TAU * pf * (i / SR) + ph) * Math.exp(-(i / SR) / tau)) / k ** 1.05;
    }
  }
  mixInto(out, norm(biquad(noise(0.008), "bandpass", 2500, 1), 0.5), 0);
  map(out, (s, t) => s * Math.min(1, t / 0.003) * (t > d ? Math.exp(-(t - d) / 0.07) : 1));
  return norm(out, 0.9);
}

function musicBox(f) {
  const n = sec(1.1);
  const out = new Float32Array(n);
  for (const [h, g, tau] of [[1, 1, 0.5], [2.76, 0.35, 0.22], [5.4, 0.15, 0.1]]) {
    for (let i = 0; i < n; i++) out[i] += g * Math.sin(TAU * f * h * (i / SR)) * Math.exp(-(i / SR) / tau);
  }
  mixInto(out, norm(biquad(noise(0.004), "highpass", 3000, 0.7), 0.3), 0);
  return norm(out, 0.9);
}

const chipLead = (f, d) => adsr(osc("pulse", f, d, { duty: 0.25 }), { a: 0.004, d: 0.03, s: 0.7, r: 0.02 });
const chipBass = (f, d) => adsr(osc("tri", f, d), { a: 0.004, d: 0.02, s: 0.9, r: 0.02 });

/** A rubber duck: one squeak per note. */
function squeak(f, d) {
  const v = (t) => f * (1 + 0.1 * Math.exp(-t / 0.02) - 0.07 * Math.max(0, (t - (d - 0.05)) / 0.05));
  const a = osc("saw", v, d);
  const b = osc("sine", v, d);
  let x = map(a, (s, t, i) => s * 0.5 + b[i]);
  x = formant(x, [[1300, 3, 0.4], [2400, 4, 1], [3400, 5, 0.7]]);
  const air = norm(biquad(noise(d), "bandpass", 3000, 1.5), 0.12);
  map(x, (s, t, i) => s + air[i] * 0.4);
  return adsr(norm(x, 0.9), { a: 0.008, d: 0.03, s: 0.8, r: 0.03 });
}

/** Musical car horn: bright, brash, slightly sour. */
function carHorn(f, d) {
  const a = osc("pulse", f, d, { duty: 0.35 });
  const b = osc("saw", f * 1.006, d);
  const c = osc("pulse", f * 2, d, { duty: 0.3 });
  let x = map(a, (s, t, i) => Math.tanh((s * 0.6 + b[i] * 0.5 + c[i] * 0.25) * 2.5));
  x = formant(x, [[800, 2, 1], [1600, 3, 0.9], [2600, 4, 0.6]]);
  return adsr(norm(x, 0.9), { a: 0.012, d: 0.02, s: 0.95, r: 0.03 });
}

/** Clown's bulb horn. */
function honk(f = 300, d = 0.26) {
  const x = drive(osc("saw", (t) => f * (1 - 0.2 * (t / d)), d), 3);
  const y = formant(x, [[1000, 4, 1], [1900, 6, 0.7], [3200, 8, 0.4]]);
  return adsr(norm(y, 0.9), { a: 0.01, d: 0.03, s: 0.9, r: 0.05 });
}

function knock(f = 190) {
  const n = buf(0.12);
  const body = osc("sine", (t) => f * (1 - 0.5 * (t / 0.12)), 0.12);
  const wood = norm(biquad(noise(0.12), "bandpass", f * 4.2, 3), 1);
  return norm(map(n, (_s, t, i) => (body[i] * 0.8 + wood[i] * 0.9) * Math.exp(-t / 0.022)), 0.9);
}

function timpani(f, d = 0.5) {
  const x = buf(d);
  for (const [h, g] of [[1, 1], [1.5, 0.5], [2, 0.45], [2.5, 0.25], [3, 0.2]]) {
    const o = osc("sine", (t) => f * h * (1 + 0.06 * Math.exp(-t / 0.03)), d);
    for (let i = 0; i < x.length; i++) x[i] += o[i] * g;
  }
  const thump = norm(biquad(noise(d), "bandpass", 260, 0.8), 0.6);
  return norm(map(x, (s, t, i) => (s + thump[i] * Math.exp(-t / 0.03)) * Math.exp(-t / 0.22)), 0.9);
}

function cymbal(d = 0.9) {
  const x = biquad(noise(d), "highpass", 4200, 0.7);
  return norm(map(x, (s, t) => s * Math.exp(-t / (d * 0.28)) * Math.min(1, t / 0.004)), 0.9);
}

function schoolBell(d = 0.55) {
  const out = buf(d);
  for (const [f, g] of [[2093, 1], [3136, 0.7], [4435, 0.5], [5274, 0.35]]) {
    const o = osc("pulse", f, d, { duty: 0.4 });
    for (let i = 0; i < out.length; i++) out[i] += o[i] * g;
  }
  // a clapper hammering 28 times a second
  map(out, (s, t) => s * (0.25 + 0.75 * Math.max(0, Math.sin(TAU * 28 * t)) ** 0.5));
  return adsr(norm(biquad(out, "highpass", 1500, 0.7), 0.9), { a: 0.004, d: 0.02, s: 0.95, r: 0.12 });
}

function bingBong() {
  const tone = (f) => {
    const n = sec(0.5);
    const o = new Float32Array(n);
    for (let i = 0; i < n; i++) o[i] = (Math.sin(TAU * f * (i / SR)) + 0.3 * Math.sin(TAU * f * 3 * (i / SR))) * Math.exp(-(i / SR) / 0.2);
    return o;
  };
  return norm(mix([tone(hz("E5")), 0, 1], [tone(hz("C5")), 0.27, 1]), 0.9).slice(0, sec(0.7));
}

/* ---------- one-off noises ---------- */

function slideWhistle() {
  const part = (from, to, d) => {
    const v = (t) => from * (to / from) ** (t / d) * (1 + 0.02 * Math.sin(TAU * 7 * t));
    const a = osc("tri", v, d);
    const b = osc("sine", v, d);
    const breath = norm(biquad(noise(d), "bandpass", v, 6), 0.3);
    return adsr(map(a, (s, t, i) => s * 0.4 + b[i] + breath[i]), { a: 0.03, d: 0.03, s: 0.95, r: 0.05 });
  };
  return chain(part(480, 1900, 0.85), 0.06, part(1900, 380, 1.0), 0.08, part(420, 2100, 0.38));
}

function wolfWhistle() {
  const glide = (points, d) => {
    // points: [fraction, hz]
    const v = (t) => {
      const u = t / d;
      for (let k = 1; k < points.length; k++) {
        if (u <= points[k][0]) {
          const [u0, f0] = points[k - 1];
          const [u1, f1] = points[k];
          return f0 * (f1 / f0) ** ((u - u0) / (u1 - u0));
        }
      }
      return points[points.length - 1][1];
    };
    const a = osc("sine", v, d);
    const b = osc("sine", (t) => 2 * v(t), d);
    const breath = norm(biquad(noise(d), "bandpass", v, 8), 0.25);
    return adsr(map(a, (s, t, i) => s + 0.07 * b[i] + breath[i]), { a: 0.03, d: 0.02, s: 0.95, r: 0.06 });
  };
  return chain(glide([[0, 900], [1, 2500]], 0.42), 0.13, glide([[0, 850], [0.25, 2000], [1, 720]], 0.72));
}

/** PE teacher's pea whistle: two sharp pips and a long angry one. */
function peWhistle() {
  const blast = (d) => {
    const fm = 44;
    const a = osc("sine", (t) => 3050 + 260 * Math.sin(TAU * fm * t) + 60 * Math.sin(TAU * 7 * t), d);
    const b = osc("sine", (t) => 2 * (3050 + 260 * Math.sin(TAU * fm * t)), d);
    const air = norm(biquad(noise(d), "bandpass", 3200, 1.5), 0.35);
    return adsr(map(a, (s, t, i) => (s + 0.2 * b[i]) * (0.6 + 0.4 * Math.sin(TAU * fm * t + 1)) + air[i]), { a: 0.012, d: 0.02, s: 0.95, r: 0.04 });
  };
  return chain(blast(0.16), 0.09, blast(0.16), 0.14, blast(1.15));
}

function kettle() {
  const d = 3.0;
  const v = (t) => 1100 * (2550 / 1100) ** Math.min(1, t / 2.3) * (1 + 0.012 * Math.sin(TAU * 9 * t) + 0.006 * Math.sin(TAU * 23 * t));
  const a = osc("sine", v, d);
  const b = osc("sine", (t) => v(t) * 2.02, d);
  const steam = biquad(noise(d), "highpass", 3500, 0.7);
  const out = map(a, (s, t, i) => (s + 0.15 * b[i]) * Math.min(1, (t / 2.4) ** 2 + 0.03) + steam[i] * 0.22 * Math.min(1, t / 1.5));
  return adsr(out, { a: 0.2, d: 0.01, s: 1, r: 0.25 });
}

function boing() {
  const one = (f, d) => {
    const v = (t) => f * (1 + 0.42 * Math.exp(-t / (d * 0.35)) * Math.sin(TAU * 9 * t));
    const x = drive(osc("saw", v, d), 2);
    const y = biquad(x, "bandpass", (t) => 500 + 1900 * Math.exp(-t / (d * 0.3)) * (0.5 + 0.5 * Math.sin(TAU * 9 * t)), 3);
    return norm(map(y, (s, t) => s * Math.exp(-t / (d * 0.33)) * Math.min(1, t / 0.004)), 0.9);
  };
  return chain(one(150, 1.0), 0.02, one(190, 0.8), 0.02, one(120, 1.3));
}

function whoopee() {
  const d = 1.9;
  let f = 130;
  let ph = 0;
  const src = buf(d);
  for (let i = 0; i < src.length; i++) {
    const t = i / SR;
    const u = t / d;
    const target = u < 0.15 ? 110 + 300 * u : u < 0.8 ? 155 - 95 * ((u - 0.15) / 0.65) : 60 + 240 * ((u - 0.8) / 0.2) ** 2;
    if (i % 400 === 0) f = target * rnd(0.86, 1.14); // lips flapping unevenly
    ph += f / SR;
    ph -= Math.floor(ph);
    src[i] = ph < 0.16 ? 1 : -0.12;
  }
  const air = biquad(noise(d), "bandpass", 900, 0.6);
  let x = map(src, (s, t, i) => s + air[i] * 0.25 * (s > 0 ? 1 : 0.2));
  x = formant(x, [[330, 2.5, 1], [900, 3, 0.8], [1700, 4, 0.5], [2600, 4, 0.25]]);
  return adsr(drive(norm(x, 1), 2.4), { a: 0.02, d: 0.05, s: 0.95, r: 0.06 });
}

function sadTrombone() {
  const notes = [["Bb3", 0.42], ["A3", 0.42], ["Ab3", 0.42], ["G3", 1.5]];
  const parts = [];
  notes.forEach(([n, d], k) => {
    const f = hz(n);
    const last = k === notes.length - 1;
    const v = (t) => f * (1 - 0.03 * (t / d) ** 2) * (last ? 1 + 0.03 * Math.sin(TAU * 4.6 * t) * Math.min(1, t / 0.4) - 0.07 * Math.max(0, (t - 0.9) / 0.6) : 1);
    const x = osc("saw", v, d);
    const cut = (t) => 280 + 1700 * Math.sin(Math.PI * Math.min(1, t / (last ? 0.55 : d))) ** 0.7 * (last ? Math.max(0.25, 1 - t / d) + 0.2 : 1);
    parts.push(adsr(norm(drive(biquad(x, "lowpass", cut, 2.2), 1.8), 0.9), { a: 0.04, d: 0.05, s: 0.9, r: last ? 0.35 : 0.06 }), 0.04);
  });
  return chain(...parts);
}

/* ---------- voices (macOS `say`) ---------- */

function readWav(file) {
  const b = readFileSync(file);
  let off = 12;
  let fmt = null;
  while (off + 8 <= b.length) {
    const id = b.toString("ascii", off, off + 4);
    const size = b.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === "fmt ") fmt = { ch: b.readUInt16LE(body + 2), sr: b.readUInt32LE(body + 4), bits: b.readUInt16LE(body + 14) };
    if (id === "data") {
      if (!fmt || fmt.bits !== 16) throw new Error(`unexpected wav format in ${file}`);
      const n = Math.floor(Math.min(size, b.length - body) / 2 / fmt.ch);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = b.readInt16LE(body + i * 2 * fmt.ch) / 32768;
      return fmt.sr === SR ? out : speed(out, fmt.sr / SR);
    }
    off = body + size + (size & 1);
  }
  throw new Error(`no audio in ${file}`);
}

function say(voice, text, { rate } = {}) {
  const key = createHash("sha1").update(`${voice}|${text}|${rate ?? ""}`).digest("hex").slice(0, 12);
  const file = path.join(TMP, `say-${key}.wav`);
  execFileSync("say", ["-v", voice, ...(rate ? ["-r", String(rate)] : []), "-o", file, "--data-format=LEI16@44100", text]);
  return norm(trim(readWav(file)), 0.9);
}

/* ---------- the fifty ---------- */

const UK = (n) => `${n} (English (UK))`;

/** id order is fixed: saved habits and the default-by-position rule depend on it. */
const SOUNDS = [
  // songs · voices · goats · whistles · fx
  { id: "pop", name: "Jack-in-the-box: Pop Goes the Weasel", emoji: "🎁", kind: "song", tags: ["snack", "food", "eat", "meal", "breakfast"],
    make: () => {
      const box = tune("C6 C6 D6 D6 E6 G6 E6 C6/1.5", 0.125, musicBox, { legato: 1 });
      const popNote = musicBox(hz("A6"));
      const pop = mix([norm(biquad(noise(0.05), "bandpass", 1400, 1), 1), 0, 1], [boingSmall(), 0.01, 0.9]);
      const tail = tune("D6/2 F6 E6/2 C6/3", 0.125, musicBox, { legato: 1 }).slice(0, sec(1.25));
      return chain(box, mix([popNote, 0, 0.8], [pop, 0, 1]).slice(0, sec(0.42)), tail);
    } },
  { id: "ding", name: "Sir: gold star", emoji: "🧑‍🏫", kind: "voice", tags: ["study", "homework", "revise", "read", "textbook", "maths"],
    make: () => chain(schoolBell(0.5), 0.08, hall(say("Daniel", "Excellent work, Hugo. Gold star."), 0.25)) },
  { id: "chime", name: "Strict grandma", emoji: "👵", kind: "voice", tags: ["posture", "stretch", "bed", "tidy", "clean"],
    make: () => say(UK("Grandma"), "Hugo! Sit up straight. Good boy.") },
  { id: "coin", name: "Grandpa: back in my day", emoji: "👴", kind: "voice", tags: ["push", "gym", "lift", "run", "train", "workout"],
    make: () => say(UK("Grandpa"), "In my day, we did that twice before breakfast.") },
  { id: "bubble", name: "Underwater teacher", emoji: "🫧", kind: "voice", tags: ["water", "hydrate", "drink", "shower", "swim"],
    make: () => say("Bubbles", "Glub glub. Well done, Hugo.") },
  { id: "boing", name: "Boing boing boing", emoji: "🪀", kind: "fx", tags: ["jump", "bounce", "skip", "basketball"],
    make: () => boing() },
  { id: "levelup", name: "Ten out of ten, so it is", emoji: "☘️", kind: "voice", tags: ["test", "exam", "quiz", "paper"],
    make: () => say("Moira", "That's ten out of ten, so it is.") },
  { id: "laser", name: "Aliens approve", emoji: "👽", kind: "voice", tags: ["space", "physics", "game"],
    make: () => say("Trinoids", "We come in peace. Nice tick, earthling.") },
  { id: "kick", name: "Aussie PE teacher", emoji: "🦘", kind: "voice", tags: ["sport", "football", "surf", "outside", "sun"],
    make: () => say("Karen", "Good on ya, Hugo. You little ripper!") },
  { id: "whoosh", name: "They know", emoji: "🤫", kind: "voice", tags: ["no", "quit", "avoid", "phone", "secret"],
    make: () => say("Whisper", "Hugo. You ticked it. They know.") },
  { id: "honk", name: "Car horn: La Cucaracha", emoji: "🚗", kind: "song", tags: ["drive", "car", "bike", "commute"],
    make: () => tune("G4/0.5 G4/0.5 G4/0.5 C5/1.5 E5/1.5 -/0.5 G4/0.5 G4/0.5 G4/0.5 C5/1.5 E5/2", 0.19, carHorn, { legato: 0.85 }) },
  { id: "quack", name: "Rubber duck plays Für Elise", emoji: "🦆", kind: "song", tags: ["bath", "shower", "wash", "teeth"],
    make: () => tune("E6 D#6 E6 D#6 E6 B5 D6 C6 A5/2.5", 0.2, squeak, { legato: 0.72 }) },
  { id: "raspberry", name: "Whoopee cushion", emoji: "🎈", kind: "fx", tags: ["sit", "chair", "silly"],
    make: () => whoopee() },
  { id: "sparkle", name: "Literally iconic", emoji: "💅", kind: "voice", tags: ["skin", "hair", "look", "outfit"],
    make: () => say("Superstar", "Oh my gosh, Hugo. Literally iconic.") },
  { id: "woodblock", name: "Shave and a haircut", emoji: "🚪", kind: "song", tags: ["knock", "door", "leave", "out"],
    make: () => {
      const beat = 0.2;
      const knocks = [0, 1, 1.5, 2, 3].map((b, k) => [knock(k === 0 ? 210 : 185), b * beat, k === 0 ? 1 : 0.8]);
      const piano = tune("C5/1 G4/0.5 G4/0.5 A4/1 G4/1", beat, honkyTonk, { legato: 0.9 });
      return mix(...knocks, [piano, 0, 0.5], [honk(310, 0.2), 5 * beat, 1], [honk(390, 0.34), 6 * beat, 1]);
    } },
  { id: "cowbell", name: "Goats do Beethoven's Fifth", emoji: "🐐", kind: "goat", tags: ["farm", "music", "piano", "practice"],
    make: () => {
      const g = (f, d) => goat(f, d);
      return chain(tune("G4/0.5 G4/0.5 G4/0.5 Eb4/3", 0.3, g, { legato: 0.86 }), 0.12, tune("F4/0.5 F4/0.5 F4/0.5 D4/3.4", 0.3, g, { legato: 0.86 }));
    } },
  { id: "tada", name: "Hallelujah choir", emoji: "😇", kind: "song", tags: ["all", "done", "finish", "complete"],
    make: () => {
      const bar = "D4+F#4+A4+D5/1.5 D4+F#4+A4/0.5 D4+G4+B4/0.5 D4+F#4+A4/1 -/0.5";
      const sung = tune(`${bar} ${bar} D3+A3+D4+F#4+A4+D5/3.2`, 0.24, choir, { legato: 0.93 });
      const end = (2 * 4 * 0.24);
      return hall(mix([sung, 0, 1], [timpani(hz("D3"), 0.9), end, 0.5], [cymbal(1.1), end, 0.22]), 0.45);
    } },
  { id: "fanfare", name: "Sunrise fanfare: Zarathustra", emoji: "🌅", kind: "song", tags: ["wake", "morning", "up", "sunlight", "alarm"],
    make: () => {
      const horns = mix(
        [brass(hz("C4"), 0.75), 0, 1], [brass(hz("C3"), 0.75), 0, 0.5],
        [brass(hz("G4"), 0.75), 0.78, 1], [brass(hz("G3"), 0.75), 0.78, 0.5],
        [brass(hz("C5"), 0.95), 1.56, 1], [brass(hz("C4"), 0.95), 1.56, 0.6],
      );
      const chordAt = 2.56;
      const major = tune("C4+E4+G4+C5+E5/1", 0.22, (f, d) => brass(f, d, 0, 0, 1.4), { legato: 1 });
      const minor = tune("C4+Eb4+G4+C5+Eb5/1", 1.25, (f, d) => brass(f, d, 0, 0, 1.2), { legato: 1 });
      const drums = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [timpani(hz(k % 2 ? "G2" : "C3"), 0.4), chordAt + 0.26 + k * 0.165, 0.9 - k * 0.07]);
      return hall(mix([horns, 0, 0.8], [major, chordAt, 0.75], [minor, chordAt + 0.22, 0.75], ...drums, [cymbal(1.0), chordAt, 0.25]), 0.35);
    } },
  { id: "siren", name: "Stop talking at the back!", emoji: "📢", kind: "voice", tags: ["quiet", "focus", "deep", "work", "silence"],
    make: () => hall(say(UK("Shelley"), "Stop talking at the back! Oh. It's a tick."), 0.5) },
  { id: "slidewhistle", name: "Slide whistle", emoji: "🎢", kind: "whistle", tags: ["stairs", "climb", "up", "down"],
    make: () => slideWhistle() },
  { id: "bouncyball", name: "Boing boing boing. Tick!", emoji: "🏀", kind: "voice", tags: ["ball", "court", "hoop"],
    make: () => say("Boing", "Boing boing boing. Tick!") },
  { id: "splat", name: "Whoa. What a tick", emoji: "🫨", kind: "voice", tags: ["cold", "ice", "plunge"],
    make: () => say("Wobble", "Whoa. What a tick.") },
  { id: "modem", name: "Robot inspector", emoji: "🤖", kind: "voice", tags: ["screen", "computer", "code", "laptop"],
    make: () => say("Zarvox", "Habit complete. Human is improving.") },
  { id: "robot", name: "Sir! Sir! Sir!", emoji: "🙋", kind: "voice", tags: ["homework", "class", "school", "lesson"],
    make: () => speed(say(UK("Eddy"), "Sir! Sir! Hugo's done his homework!"), 1.22) },
  { id: "meow", name: "Goats sing Baa Baa Black Sheep", emoji: "🐑", kind: "goat", tags: ["sleep", "bed", "night", "wool"],
    make: () => tune("C4 C4 G4 G4 A4/0.5 A4/0.5 A4/0.5 A4/0.5 G4/2.2", 0.3, (f, d) => goat(f, d), { legato: 0.84 }) },
  { id: "moo", name: "Two goats", emoji: "🐐", kind: "goat", tags: ["walk", "field", "grass", "outside"],
    make: () => chain(goat(410, 0.95), 0.22, goat(330, 1.25)) },
  { id: "bark", name: "Screaming goat", emoji: "😱", kind: "goat", tags: ["cold", "shower", "hard", "pain", "leg"],
    make: () => chain(goat(470, 1.5, { scream: true }), 0.18, goat(520, 0.55, { scream: true })) },
  { id: "snore", name: "The bell does not dismiss you", emoji: "🔔", kind: "voice", tags: ["time", "late", "early", "wind", "lights"],
    make: () => chain(schoolBell(0.42), 0.06, hall(say(UK("Reed"), "The bell does not dismiss you. I dismiss you."), 0.3)) },
  { id: "burp", name: "Not bad, kid", emoji: "🧢", kind: "voice", tags: ["protein", "cook", "meal", "lunch", "dinner"],
    make: () => say("Albert", "Not bad, kid. Not bad.") },
  { id: "spaceship", name: "Head teacher on the tannoy", emoji: "📣", kind: "voice", tags: ["announce", "plan", "goal", "review"],
    make: () => chain(bingBong(), 0.02, tannoy(say("Ralph", "This is your head teacher. Hugo wins."))) },
  { id: "wahwah", name: "Sad trombone", emoji: "🎺", kind: "song", tags: ["fail", "junk", "sugar", "sad"],
    make: () => sadTrombone() },
  { id: "bells", name: "Singing bells", emoji: "🛎️", kind: "voice", tags: ["meditate", "breathe", "calm", "pray"],
    make: () => say("Bells", "Ding dong. Well done.") },
  { id: "alarm", name: "Homework! On my desk!", emoji: "📚", kind: "voice", tags: ["essay", "write", "notes", "econ", "economics"],
    make: () => hall(say(UK("Flo"), "Homework! On my desk! Thank you."), 0.3) },
  { id: "kazoo", name: "Kazoo: William Tell", emoji: "🏇", kind: "song", tags: ["fast", "sprint", "race", "horse", "cardio"],
    make: () =>
      tune(
        "G4/0.25 G4/0.25 G4/0.5 G4/0.25 G4/0.25 G4/0.5 G4/0.25 G4/0.25 C5/0.5 D5/0.5 E5/0.5 C5/0.5 E5/0.5 G5/1 F5/0.5 E5/0.5 D5/0.5 C5/0.5 E5/0.5 C5/1.2",
        0.34, kazoo, { legato: 0.82, transpose: 5 },
      ) },
  { id: "chicken", name: "Sheep says well done", emoji: "🐏", kind: "goat", tags: ["jumper", "warm", "count"],
    make: () => chain(goat(360, 0.8), 0.12, say("Bahh", "Well done, Hugo.")) },
  { id: "cuckoo", name: "Cellos: Hall of the Mountain King", emoji: "🎻", kind: "voice", tags: ["sneak", "creep", "mountain", "hike"],
    make: () => say("Cellos", "Doo doo doo doo, Hugo did it") },
  { id: "applause", name: "Teacher on helium", emoji: "🎈", kind: "voice", tags: ["breath", "lungs", "balloon", "party"],
    make: () => speed(say("Rishi", "Very good. Very, very good. Next!"), 1.42) },
  { id: "typewriter", name: "See me after class", emoji: "✍️", kind: "voice", tags: ["journal", "diary", "log", "write"],
    make: () => say("Tessa", "See me after class, Hugo. To collect your prize.") },
  { id: "wave", name: "Kettle coming to the boil", emoji: "🫖", kind: "whistle", tags: ["tea", "coffee", "kitchen", "boil"],
    make: () => kettle() },
  { id: "birds", name: "Whistler: Colonel Bogey", emoji: "😗", kind: "whistle", tags: ["march", "walk", "steps", "stroll"],
    make: () => tune("G5/1 E5/1.5 -/0.5 E5/0.5 F5/0.5 G5/1 E6/1 E6/1 C6/2.2", 0.26, whistle, { legato: 0.86 }) },
  { id: "thunder", name: "Bad News: the old Hugo is gone", emoji: "⚰️", kind: "voice", tags: ["no", "stop", "ban", "never"],
    make: () => say("Bad News", "Lazy old Hugo is gone") },
  { id: "gameover", name: "8-bit Can-can", emoji: "💃", kind: "song", tags: ["dance", "legs", "kick", "stretch", "mobility"],
    make: () => {
      const e = 0.115;
      const lead = tune("C5/4 D5 F5 E5 D5 G5/2 G5/2 G5 A5 E5 F5 D5/2 D5/2 D5 F5 E5 D5 C5 C6 B5 A5 G5 F5 E5 D5 C5/3", e, chipLead, { legato: 0.8 });
      const bass = tune("C3/2 G3/2 C3/2 G3/2 C3/2 G3/2 C3/2 G3/2 G2/2 D3/2 G2/2 D3/2 C3/2 G3/2 G2/2 B2/2 C3/3", e, chipBass, { legato: 0.7 });
      const hat = buf(lead.length / SR);
      for (let k = 0; k * e * 2 < lead.length / SR - 0.3; k++) mixInto(hat, adsr(biquad(noise(0.03), "highpass", 6000, 0.7), { a: 0.001, r: 0.02, s: 1 }), k * e * 2 + e);
      return mix([lead, 0, 0.6], [bass, 0, 0.75], [hat, 0, 0.3]);
    } },
  { id: "powerup", name: "Good News: hooray for Hugo", emoji: "🎓", kind: "voice", tags: ["graduate", "grade", "result", "win"],
    make: () => say("Good News", "Hooray for Hugo") },
  { id: "victory", name: "Kazoo: God Save the King", emoji: "👑", kind: "song", tags: ["king", "royal", "proud", "stand"],
    make: () => tune("G4/1 G4/1 A4/1 F#4/1.5 G4/0.5 A4/1 B4/1 B4/1 C5/1 B4/1.5 A4/0.5 G4/2.4", 0.27, kazoo, { legato: 0.9, transpose: 5 }) },
  { id: "howl", name: "Wolf whistle", emoji: "😎", kind: "whistle", tags: ["look", "mirror", "skin", "hair", "fit"],
    make: () => wolfWhistle() },
  { id: "doorbell", name: "Dracula's organ", emoji: "🧛", kind: "song", tags: ["dark", "night", "evening", "dim"],
    make: () => {
      const run = chain(tune("A5/0.45 G5/0.45 A5/6", 0.2, organ, { legato: 1 }), 0.12, tune("G5 F5 E5 D5 C#5/4.5 D5/9", 0.105, organ, { legato: 1 }));
      const low = speed(run, 0.5).slice(0, run.length);
      return hall(mix([run, 0, 0.8], [low, 0, 0.35]), 0.7);
    } },
  { id: "telephone", name: "Is something funny, Hugo?", emoji: "🧐", kind: "voice", tags: ["laugh", "joke", "friends", "call"],
    make: () => hall(say(UK("Sandy"), "Is something funny, Hugo? Share it with the class."), 0.3) },
  { id: "gallop", name: "PE teacher's whistle", emoji: "🏃", kind: "whistle", tags: ["run", "laps", "pe", "sport", "football"],
    make: () => peWhistle() },
  { id: "helicopter", name: "Kazoo bumblebee", emoji: "🐝", kind: "song", tags: ["bee", "honey", "busy", "buzz"],
    make: () =>
      tune("E6 Eb6 D6 Db6 C6 F6 E6 Eb6 D6 Db6 C6 B5 C6 Db6 D6 Eb6 E6 Eb6 D6 Db6 C6 F6 E6 Eb6 D6 Db6 C6 B5 C6/1 E6/1 A6/3", 0.082, kazoo, { legato: 0.95, transpose: -12 }) },
  { id: "airhorn", name: "Saloon piano: The Entertainer", emoji: "🎹", kind: "song", tags: ["fun", "play", "relax", "break"],
    make: () => tune("D5 D#5 E5 C6/2 E5 C6/2 E5 C6/4 -/1 C6 D6 D#6 E6 C6 D6 E6/2 B5 D6/2 C6/5", 0.105, honkyTonk, { legato: 1 }) },
];

function boingSmall() {
  const d = 0.5;
  const v = (t) => 300 * (1 + 0.4 * Math.exp(-t / 0.15) * Math.sin(TAU * 13 * t));
  return norm(map(osc("tri", v, d), (s, t) => s * Math.exp(-t / 0.16)), 0.9);
}

/* ---------- loudness (the same measure the app uses) ---------- */

function loudnessOf(data) {
  const n = data.length;
  const rc = 1 / (TAU * 250);
  const alpha = rc / (rc + 1 / SR);
  const win = Math.floor(SR * 0.3);
  const hop = Math.floor(win / 3);
  const hp = new Float32Array(n);
  let px = 0, py = 0, peak = 0;
  for (let i = 0; i < n; i++) {
    const y = alpha * (py + data[i] - px);
    px = data[i]; py = y; hp[i] = y * y;
    peak = Math.max(peak, Math.abs(data[i]));
  }
  let maxHp = 0, maxFull = 0;
  for (let s = 0; s < n; s += hop) {
    let a = 0, b = 0;
    for (let i = s; i < Math.min(n, s + win); i++) { a += hp[i]; b += data[i] * data[i]; }
    maxHp = Math.max(maxHp, a / win); maxFull = Math.max(maxFull, b / win);
  }
  return { loudness: Math.max(Math.sqrt(maxHp), Math.sqrt(maxFull) / 1.25), peak };
}

function level(data, target = 0.3) {
  const first = loudnessOf(data);
  if (first.peak < 1e-5) throw new Error("silent clip");
  const maxGain = 14 / first.peak;
  let g = Math.min(target / first.loudness, maxGain);
  const work = new Float32Array(data.length);
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 0; i < data.length; i++) work[i] = Math.tanh(data[i] * g);
    const ratio = target / loudnessOf(work).loudness;
    if (Math.abs(ratio - 1) < 0.015 || g >= maxGain) break;
    g = Math.min(g * ratio, maxGain);
  }
  return map(data, (v) => Math.tanh(v * g));
}

function finish(x) {
  let y = trim(x, 0.004, 0.012);
  if (y.length > sec(MAX_SECONDS)) throw new Error(`clip is ${(y.length / SR).toFixed(1)}s, longer than ${MAX_SECONDS}s: shorten it`);
  y = biquad(y, "highpass", 70, 0.7); // nothing a phone can play lives down there
  level(y);
  const fi = sec(0.004);
  const fo = sec(0.05);
  for (let i = 0; i < fi; i++) y[i] *= i / fi;
  for (let i = 0; i < fo; i++) y[y.length - 1 - i] *= i / fo;
  return y;
}

/* ---------- build ---------- */

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

const rows = [];
for (const s of SOUNDS) {
  if (only.length && !only.includes(s.id)) continue;
  seed = createHash("sha1").update(s.id).digest().readInt32LE(0); // each sound has its own dice, so rebuilding one never changes another
  const pcm = finish(s.make());
  if (pcm.some((v) => !Number.isFinite(v))) throw new Error(`${s.id}: bad samples`);
  const raw = path.join(TMP, `${s.id}.f32`);
  writeFileSync(raw, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength));
  const file = path.join(OUT, `${s.id}.mp3`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "f32le", "-ar", String(SR), "-ac", "1", "-i", raw, "-codec:a", "libmp3lame", "-b:a", "64k", "-ar", String(SR), file]);
  const m = loudnessOf(pcm);
  const dur = Math.round((pcm.length / SR) * 10) / 10;
  rows.push({ ...s, dur });
  console.log(`${s.id.padEnd(13)} ${s.kind.padEnd(8)} ${dur.toFixed(1)}s  loud ${m.loudness.toFixed(3)}  peak ${m.peak.toFixed(2)}  ${s.name}`);
}

if (!only.length) {
  const list = rows.map((r) => `  { id: ${JSON.stringify(r.id)}, name: ${JSON.stringify(r.name)}, emoji: ${JSON.stringify(r.emoji)}, dur: ${r.dur}, kind: ${JSON.stringify(r.kind)}, tags: ${JSON.stringify(r.tags)} },`).join("\n");
  writeFileSync(
    path.join(ROOT, "src", "lib", "sound-list.ts"),
    `// Generated by scripts/make-sounds.mjs. Don't edit by hand: change the script and run it again.\n\nexport type SoundKind = "voice" | "goat" | "whistle" | "song" | "fx";\nexport type SoundDef = { id: string; name: string; emoji: string; /** Length in seconds. */ dur: number; kind: SoundKind; /** Words in a habit name that make this sound a good fit. */ tags: string[] };\n\n/** Bump when the files change, so phones fetch the new ones instead of their cached copies. */\nexport const SOUND_VERSION = ${JSON.stringify(VERSION)};\n\nexport const SOUND_LIST: SoundDef[] = [\n${list}\n];\n`,
  );
  console.log(`\n${rows.length} sounds written to public/sounds, list written to src/lib/sound-list.ts`);
}
rmSync(TMP, { recursive: true, force: true });
