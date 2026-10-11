/**
 * Storage for the day's vlog.
 *
 * A vlog is recorded on the device, cut into pieces and uploaded to /vlogs/<date>/<recordedAt>/<n> in the
 * database; the day record only carries a small label saying how to put it back together. Like the journal and
 * the photos it is stored as it is (no passphrase), and it is never sent to Claude.
 *
 * Uploads go through a queue in IndexedDB, so a vlog recorded offline (or interrupted) finishes later.
 * No video ever touches localStorage.
 */
import { DATA_PATH, cloudConfigured } from "./firebase";

/** Longest vlog the in-app recorder allows. */
export const VLOG_MAX_SECONDS = 180;
/** Biggest single clip accepted (matters most for the "use the phone's camera" fallback, which can't be throttled). */
export const VLOG_MAX_BYTES = 48 * 1024 * 1024;
/** How much of the free 1 GB database vlogs may use. Past this, recording asks you to clear some first. */
export const VLOG_BUDGET_BYTES = 700 * 1024 * 1024;
/** Recording quality: small on purpose, so months of vlogs fit in the free database. */
export const VLOG_VIDEO_BPS = 260_000;
export const VLOG_AUDIO_BPS = 32_000;

const CHUNK_BYTES = 384 * 1024;
const CACHE_KEEP = 6;
const DB_NAME = "locked-in-vlogs";
const PENDING = "pending";
const CACHE = "cache";
const DB_URL = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "").replace(/\/+$/, "");

/** Bytes a video of this size takes up in the database (base64 plus a little overhead). */
export const storedSize = (bytes: number) => Math.ceil(bytes * 1.34);

export type PendingVlog = {
  date: string;
  at: number;
  dur: number;
  bytes: number;
  mime: string;
  /** The video in pieces, ready to upload. */
  chunks: ArrayBuffer[];
  uploaded: number;
};

type CachedVlog = { date: string; at: number; chunks: ArrayBuffer[]; usedAt: number };

export function vlogStorageAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export const vlogPath = (date: string, at: number) => `${DATA_PATH}/vlogs/${date}/${at}`;
const chunkUrl = (date: string, at: number, i: number) => `${DB_URL}/${vlogPath(date, at)}/${i}.json`;

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) s += String.fromCharCode.apply(null, bytes.subarray(i, i + step) as unknown as number[]);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/* ---------- IndexedDB ---------- */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(PENDING, { keyPath: "date" });
      req.result.createObjectStore(CACHE, { keyPath: "date" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const t = db.transaction(store, mode);
      const req = run(t.objectStore(store));
      let result: T | undefined;
      if (req) req.onsuccess = () => (result = req.result);
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

/* ---------- the upload queue ---------- */

/** Cut a recording into pieces and put it in the queue (replacing any earlier unfinished one for that day). */
export async function queueVlog(date: string, blob: Blob, dur: number): Promise<PendingVlog> {
  const chunks: ArrayBuffer[] = [];
  for (let offset = 0; offset < blob.size; offset += CHUNK_BYTES) chunks.push(await blob.slice(offset, offset + CHUNK_BYTES).arrayBuffer());
  if (!chunks.length) throw new Error("That recording was empty.");
  const mime = (blob.type || "video/mp4").split(";")[0];
  const pending: PendingVlog = { date, at: Date.now(), dur: Math.round(dur), bytes: blob.size, mime, chunks, uploaded: 0 };
  try {
    await tx(PENDING, "readwrite", (s) => s.put(pending));
  } catch {
    throw new Error("This device couldn't store the recording (storage may be full, or this is a private window).");
  }
  return pending;
}

export async function getPending(date: string): Promise<PendingVlog | null> {
  try {
    return ((await tx<PendingVlog>(PENDING, "readonly", (s) => s.get(date))) as PendingVlog | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function listPending(): Promise<PendingVlog[]> {
  try {
    return ((await tx<PendingVlog[]>(PENDING, "readonly", (s) => s.getAll())) as PendingVlog[] | undefined) ?? [];
  } catch {
    return [];
  }
}

export async function dropPending(date: string): Promise<void> {
  try {
    await tx(PENDING, "readwrite", (s) => s.delete(date));
  } catch {
    /* ignore */
  }
}

async function request(url: string, init: RequestInit, timeoutMs = 60_000): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Upload whatever pieces of this vlog haven't gone up yet, remembering progress after each one so an
 * interrupted upload carries on where it stopped. Throws if the network gives up.
 */
export async function uploadPending(p: PendingVlog, onProgress?: (uploaded: number) => void): Promise<void> {
  if (!cloudConfigured || !DB_URL) {
    p.uploaded = p.chunks.length; // local-only mode: the copy on this device is the vlog
    return;
  }
  for (let i = p.uploaded; i < p.chunks.length; i++) {
    const body = JSON.stringify(bytesToB64(new Uint8Array(p.chunks[i])));
    await request(`${chunkUrl(p.date, p.at, i)}?print=silent`, { method: "PUT", body, headers: { "Content-Type": "application/json" } });
    p.uploaded = i + 1;
    // Only bump the counter if this is still the queued recording (it may have been replaced or deleted meanwhile).
    const current = await getPending(p.date);
    if (!current || current.at !== p.at) throw new Error("replaced");
    await tx(PENDING, "readwrite", (s) => s.put({ ...current, uploaded: p.uploaded }));
    onProgress?.(p.uploaded);
  }
}

/** Upload finished: keep the pieces on this device as a cache so it plays instantly here. */
export async function promoteToCache(p: PendingVlog): Promise<void> {
  await cacheChunks(p.date, p.at, p.chunks);
  await dropPending(p.date);
}

/* ---------- a small on-device cache ---------- */

export async function cachedChunks(date: string, at: number): Promise<ArrayBuffer[] | null> {
  try {
    const hit = (await tx<CachedVlog>(CACHE, "readonly", (s) => s.get(date))) as CachedVlog | undefined;
    return hit && hit.at === at && hit.chunks.length ? hit.chunks : null;
  } catch {
    return null;
  }
}

export async function cacheChunks(date: string, at: number, chunks: ArrayBuffer[]): Promise<void> {
  try {
    await tx(CACHE, "readwrite", (s) => s.put({ date, at, chunks, usedAt: Date.now() } satisfies CachedVlog));
    if (!cloudConfigured) return; // local-only: the cache is the only copy, never prune it
    const keys = ((await tx<IDBValidKey[]>(CACHE, "readonly", (s) => s.getAllKeys())) as string[] | undefined) ?? [];
    const extra = keys.filter((k) => k !== date).sort().slice(0, Math.max(0, keys.length - CACHE_KEEP));
    for (const k of extra) await tx(CACHE, "readwrite", (s) => s.delete(k));
  } catch {
    /* no room / private mode: it just downloads again next time */
  }
}

export async function dropCached(date: string): Promise<void> {
  try {
    await tx(CACHE, "readwrite", (s) => s.delete(date));
  } catch {
    /* ignore */
  }
}

/* ---------- downloading ---------- */

/** Fetch the pieces of a vlog from the database, a few at a time. */
export async function downloadChunks(date: string, at: number, count: number, onProgress?: (fraction: number) => void): Promise<ArrayBuffer[]> {
  if (!cloudConfigured || !DB_URL) throw new Error("This vlog isn't on this device.");
  const out: ArrayBuffer[] = new Array(count);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < count) {
      const i = next++;
      const res = await request(chunkUrl(date, at, i), { method: "GET" });
      const b64 = (await res.json()) as unknown;
      if (typeof b64 !== "string" || !b64) throw new Error("A piece of this vlog is missing.");
      out[i] = b64ToBytes(b64).buffer;
      done++;
      onProgress?.(done / count);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, count) }, worker));
  return out;
}

/* ---------- recording helpers ---------- */

/** Recording formats this browser offers, best first. MP4 leads: it plays everywhere, including iPhone. */
export function recorderMimes(): string[] {
  if (typeof MediaRecorder === "undefined") return [];
  const options = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  const ok = options.filter((m) => {
    try {
      return MediaRecorder.isTypeSupported(m);
    } catch {
      return false;
    }
  });
  return ok.length ? ok : [""]; // "" = let the browser choose
}

export function recorderSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
}

/** Length of a video file in seconds (0 if the browser can't tell). */
export function videoDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const v = document.createElement("video");
    let settled = false;
    const finish = (d: number) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) && d > 0 ? d : 0);
    };
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => finish(v.duration);
    v.onerror = () => finish(0);
    window.setTimeout(() => finish(0), 4000);
    v.src = url;
  });
}
