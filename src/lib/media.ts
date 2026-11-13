/**
 * Storage for audio and video: voice-journal recordings and habit edits.
 *
 * A file is cut into 384 KB pieces and each piece is stored as base64 at <path>/<n> in the database, through the
 * REST API (the realtime SDK isn't built for blobs). The label (length, size, number of pieces) lives elsewhere, so
 * lists stay small. Each device keeps copies in IndexedDB so things play instantly and recordings made offline are
 * never lost: they wait in a queue and upload when the connection comes back. Nothing here touches localStorage.
 */
import { cloudConfigured } from "./firebase";

export const CHUNK_BYTES = 384 * 1024;
export const DB_URL = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "").replace(/\/+$/, "");
export const canUpload = () => cloudConfigured && Boolean(DB_URL);

const DB_NAME = "locked-in-media";
/** Recordings waiting to upload (and the only copy until they have). */
export const PENDING = "pending";
/** Copies of things already uploaded, so they play instantly on this device. */
export const CACHE = "cache";

/* ---------- base64 ---------- */

export function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) s += String.fromCharCode.apply(null, bytes.subarray(i, i + step) as unknown as number[]);
  return btoa(s);
}

export function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/* ---------- IndexedDB ---------- */

export function storageAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(PENDING)) req.result.createObjectStore(PENDING, { keyPath: "id" });
      if (!req.result.objectStoreNames.contains(CACHE)) req.result.createObjectStore(CACHE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
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

/** Cut a file into pieces. */
export async function toChunks(blob: Blob): Promise<ArrayBuffer[]> {
  const out: ArrayBuffer[] = [];
  for (let offset = 0; offset < blob.size; offset += CHUNK_BYTES) out.push(await blob.slice(offset, offset + CHUNK_BYTES).arrayBuffer());
  return out;
}

/* ---------- the on-device cache ---------- */

type Cached = { id: string; chunks: ArrayBuffer[]; at: number };

export async function cached(id: string, count: number): Promise<ArrayBuffer[] | null> {
  try {
    const hit = (await tx<Cached>(CACHE, "readonly", (s) => s.get(id))) as Cached | undefined;
    return hit && hit.chunks.length === count ? hit.chunks : null;
  } catch {
    return null;
  }
}

/** Keep a copy; the oldest copies beyond `keep` are dropped (they download again when needed). */
export async function keep(id: string, chunks: ArrayBuffer[], max = 60): Promise<void> {
  try {
    await tx(CACHE, "readwrite", (s) => s.put({ id, chunks, at: Date.now() } satisfies Cached));
    if (!canUpload()) return; // local-only: the cache is the only copy, never prune it
    const all = ((await tx<Cached[]>(CACHE, "readonly", (s) => s.getAll())) as Cached[] | undefined) ?? [];
    for (const e of all.sort((a, b) => b.at - a.at).slice(max)) await tx(CACHE, "readwrite", (s) => s.delete(e.id));
  } catch {
    /* no room / private mode: it just downloads again next time */
  }
}

export async function forget(id: string): Promise<void> {
  try {
    await tx(CACHE, "readwrite", (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}

/* ---------- the network ---------- */

export async function request(url: string, init: RequestInit, timeoutMs = 60_000): Promise<Response> {
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

/** Upload pieces to <path>/<n> (a database path, without the URL), starting at `from`. */
export async function putPieces(path: string, chunks: ArrayBuffer[], from = 0, onEach?: (uploaded: number) => void | Promise<void>): Promise<void> {
  for (let i = from; i < chunks.length; i++) {
    const body = JSON.stringify(bytesToB64(new Uint8Array(chunks[i])));
    await request(`${DB_URL}/${path}/${i}.json?print=silent`, { method: "PUT", body, headers: { "Content-Type": "application/json" } });
    await onEach?.(i + 1);
  }
}

/** Download pieces <path>/0 … <path>/<count-1>, three at a time. */
export async function getPieces(path: string, count: number, onProgress?: (fraction: number) => void): Promise<ArrayBuffer[]> {
  const out: ArrayBuffer[] = new Array(count);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < count) {
      const i = next++;
      const res = await request(`${DB_URL}/${path}/${i}.json`, { method: "GET" });
      const b64 = (await res.json()) as unknown;
      if (typeof b64 !== "string" || !b64) throw new Error("A piece of this file is missing.");
      out[i] = b64ToBytes(b64).buffer;
      done++;
      onProgress?.(done / count);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, count) }, worker));
  return out;
}

/** Delete <path> and everything under it. */
export async function removePath(path: string): Promise<void> {
  if (!canUpload()) return;
  await request(`${DB_URL}/${path}.json`, { method: "DELETE" }).catch(() => undefined);
}

/* ---------- small helpers ---------- */

/** Length of an audio or video file in seconds (0 if the browser can't tell). */
export function mediaDuration(blob: Blob, kind: "audio" | "video" = "video"): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const el = document.createElement(kind);
    let settled = false;
    const finish = (d: number) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) && d > 0 ? d : 0);
    };
    el.preload = "metadata";
    el.muted = true;
    el.onloadedmetadata = () => finish(el.duration);
    el.onerror = () => finish(0);
    window.setTimeout(() => finish(0), 4000);
    el.src = url;
  });
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
