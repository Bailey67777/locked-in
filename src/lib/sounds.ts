/**
 * Fifty daft sounds: school teachers, goats, weird whistles and public-domain tunes on silly instruments.
 *
 * They are small MP3 files in /public/sounds, built by scripts/make-sounds.mjs (voices from the Mac's built-in
 * speech, everything else synthesised there; nothing is sampled from anyone's recording). Each file is levelled to
 * the same loudness when it is built, and checked again here after decoding, so no sound is louder than another.
 *
 * The 50 ids never change (saved habits point at them); what each id sounds like can.
 */
import { SOUND_LIST, SOUND_VERSION, type SoundDef } from "./sound-list";

export type { SoundDef };
export const SOUNDS: SoundDef[] = SOUND_LIST;
export const SOUND_IDS = SOUNDS.map((s) => s.id);
export const DEFAULT_TODO_SOUND = "pop";
export const DEFAULT_DAY_COMPLETE_SOUND = "tada";

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function soundById(id: string | undefined): SoundDef {
  return SOUNDS.find((s) => s.id === id) ?? SOUNDS[0];
}

const soundUrl = (id: string) => `/sounds/${id}.mp3?v=${SOUND_VERSION}`;

/* ---------- loading, loudness matching and playback ---------- */

/** Every sound is brought to this short-term loudness, then soft-limited. Higher = louder. */
const TARGET_RMS = 0.3;

let ctx: AudioContext | null = null;
let unlocked = false;
const cache = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<AudioBuffer | null>>();

/** `inTap`: called from inside a tap, so the browser lets us start (and unlock) audio. */
function getCtx(inTap: boolean): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (!inTap) return ctx;
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
 * Bring `data` to the target loudness, measured AFTER the tanh soft limiter, so spiky sounds and smooth ones
 * really do come out equal. Clips that are already within a few percent (every file as built) are left alone.
 */
export function normalizeSamples(data: Float32Array, sampleRate: number, target = TARGET_RMS): void {
  const n = data.length;
  if (!n) return;
  const first = loudnessOf(data, sampleRate);
  if (first.peak < 1e-5 || first.loudness < 1e-7) return;
  if (Math.abs(first.loudness / target - 1) < 0.06 && first.peak <= 1) return;
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
}

function decode(c: AudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  // The callback form works on every Safari; newer browsers also return a promise.
  return new Promise((resolve, reject) => {
    const p = c.decodeAudioData(bytes, resolve, reject);
    if (p && typeof p.then === "function") p.then(resolve, reject);
  });
}

function loadSound(id: string): Promise<AudioBuffer | null> {
  const ready = cache.get(id);
  if (ready) return Promise.resolve(ready);
  const running = loading.get(id);
  if (running) return running;
  const job = (async () => {
    try {
      const c = getCtx(false);
      if (!c) return null;
      const res = await fetch(soundUrl(id));
      if (!res.ok) return null;
      const buf = await decode(c, await res.arrayBuffer());
      for (let ch = 0; ch < buf.numberOfChannels; ch++) normalizeSamples(buf.getChannelData(ch), buf.sampleRate);
      cache.set(id, buf);
      return buf;
    } catch {
      return null; // offline and not cached yet, or the browser can't decode it: stay silent
    } finally {
      loading.delete(id);
    }
  })();
  loading.set(id, job);
  return job;
}

function startBuffer(c: AudioContext, buf: AudioBuffer) {
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start();
}

export function playSound(id: string | undefined): void {
  const c = getCtx(true); // must happen synchronously inside the tap
  if (!c) return;
  const key = soundById(id).id;
  const ready = cache.get(key);
  if (ready) return startBuffer(c, ready);
  void loadSound(key).then((buf) => {
    if (buf) startBuffer(c, buf);
  });
}

/** Load these in the background so the first tap is instant. */
export function prewarmSounds(ids: (string | undefined)[]): void {
  if (typeof window === "undefined") return;
  const todo = [...new Set(ids.map((i) => soundById(i).id))].filter((i) => !cache.has(i));
  const next = () => {
    const id = todo.shift();
    if (!id) return;
    void loadSound(id).then(() => window.setTimeout(next, 30));
  };
  window.setTimeout(next, 400);
}

/* ---------- lucky dip: a different random sound every tick ---------- */

let bag: string[] = [];
let lastRandom = "";

/** A shuffled run through all fifty before any repeats, never the same one twice in a row. */
function refillBag() {
  const ids = [...SOUND_IDS];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  if (ids[ids.length - 1] === lastRandom && ids.length > 1) [ids[0], ids[ids.length - 1]] = [ids[ids.length - 1], ids[0]];
  bag = ids;
}

/** Get the next few lucky-dip sounds ready, so a random tick is as instant as a fixed one. */
export function prewarmRandom(count = 3): void {
  if (typeof window === "undefined") return;
  if (bag.length < count) refillBag();
  prewarmSounds(bag.slice(-count));
}

/** Play the next sound from the shuffled bag. Returns its id. */
export function playRandomSound(): string {
  if (!bag.length) refillBag();
  // Prefer one that's already loaded (instant); otherwise take the next and let it load.
  const from = Math.max(0, bag.length - 4);
  let at = bag.length - 1;
  for (let i = bag.length - 1; i >= from; i--) {
    if (cache.has(bag[i])) {
      at = i;
      break;
    }
  }
  const [id] = bag.splice(at, 1);
  lastRandom = id;
  playSound(id);
  window.setTimeout(() => prewarmRandom(), 60);
  return id;
}

let precached = false;
/**
 * Fetch every sound file once, quietly, so the service worker has them all for when there's no signal.
 * Nothing is decoded here; it only fills the offline cache.
 */
export function precacheSounds(): void {
  if (precached || typeof window === "undefined" || !navigator.onLine) return;
  precached = true;
  const todo = [...SOUND_IDS];
  const next = () => {
    const id = todo.shift();
    if (!id) return;
    fetch(soundUrl(id))
      .then((r) => r.arrayBuffer())
      .catch(() => undefined)
      .then(() => window.setTimeout(next, 250));
  };
  window.setTimeout(next, 6000);
}

/** Dev / test hook: load one sound and report its measured loudness. */
export async function measureSound(id: string): Promise<{ id: string; rms: number; peak: number; seconds: number } | null> {
  const buf = await loadSound(id);
  if (!buf) return null;
  const m = loudnessOf(buf.getChannelData(0), buf.sampleRate);
  return { id, rms: m.loudness, peak: m.peak, seconds: buf.duration };
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
  (window as unknown as Record<string, unknown>).__lockedInSounds = { SOUNDS, measureSound, playSound, playRandomSound };
}
