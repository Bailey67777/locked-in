/**
 * Storage for the progress photos.
 *
 * A photo is shrunk to a JPEG and a thumbnail on the device that took it, and both are encrypted with the photo key
 * (see vault.ts) before they go anywhere. Each becomes one base64 string: in the cloud at <space>/body/<id>/f (full
 * size) and /t (thumbnail), through the REST API, and on the device in IndexedDB, so photos show instantly and one
 * taken offline is never lost: it waits in a queue and uploads when the connection returns. What sits on the device
 * is still encrypted; a photo is only ever unlocked in memory, while it is being shown.
 */
import { DATA_PATH } from "../firebase";
import { DB_URL, canUpload, removePath, request } from "../media";
import { uid } from "./model";
import type { PhotoMeta } from "./types";
import { seal, unseal } from "./vault";

/** Long edge of the stored photo, px. */
export const FULL_EDGE = 1280;
/** Long edge of the thumbnail, px. */
export const THUMB_EDGE = 360;
const FULL_QUALITY = 0.76;
const THUMB_QUALITY = 0.6;
/** Full-size copies a device keeps. Thumbnails are small, so all of those stay. */
const KEEP_FULL = 150;
/** EXIF sits at the very start of a JPEG, in a block of at most 64 KB. */
const EXIF_BYTES = 256 * 1024;

const CANT_OPEN = "Couldn't open that photo.";

export type Prepared = { full: Blob; thumb: Blob; w: number; h: number; takenAt: number | null };
type Size = "thumb" | "full";

/* ---------- when a photo was taken ---------- */

/** The TIFF block inside a JPEG's Exif segment, or null. A view of just that block, so nothing can be read past it. */
function exifBlock(v: DataView): DataView | null {
  if (v.getUint16(0) !== 0xffd8) return null; // not a JPEG
  let at = 2;
  while (at + 4 <= v.byteLength) {
    if (v.getUint8(at) !== 0xff) return null;
    const marker = v.getUint8(at + 1);
    if (marker === 0xff) {
      at++; // padding before a marker
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return null; // the picture itself starts here: there was no Exif
    const size = v.getUint16(at + 2); // counts its own two bytes
    if (size < 2) return null;
    // APP1 that begins "Exif\0\0" (XMP uses APP1 too).
    if (marker === 0xe1 && v.getUint32(at + 4) === 0x45786966 && v.getUint16(at + 8) === 0) {
      const end = Math.min(at + 2 + size, v.byteLength);
      return new DataView(v.buffer, v.byteOffset + at + 10, end - (at + 10));
    }
    at += 2 + size;
  }
  return null;
}

/** Where the 12-byte entry for `tag` starts in the directory at `dir`, or null. */
function findEntry(t: DataView, dir: number, tag: number, little: boolean): number | null {
  const count = t.getUint16(dir, little);
  for (let i = 0; i < count; i++) {
    const at = dir + 2 + i * 12;
    if (t.getUint16(at, little) === tag) return at;
  }
  return null;
}

/** The text of an entry. Up to four bytes sit inside the entry itself; anything longer is elsewhere in the block. */
function entryText(t: DataView, entry: number | null, little: boolean): string {
  if (entry === null || t.getUint16(entry + 2, little) !== 2) return ""; // 2 = text
  const length = t.getUint32(entry + 4, little);
  const start = length <= 4 ? entry + 8 : t.getUint32(entry + 8, little);
  let text = "";
  for (let i = 0; i < Math.min(length, 32); i++) {
    const c = t.getUint8(start + i);
    if (c === 0) break;
    text += String.fromCharCode(c);
  }
  return text;
}

/**
 * When a JPEG was taken, from its EXIF (DateTimeOriginal, plus the fraction of a second when the camera wrote one),
 * or null if it doesn't say. Cameras write local time with no zone, so it is read as this device's local time.
 * Never throws: a DataView refuses any read outside its bytes, and running off the end just means "no date".
 */
export function exifTakenAt(bytes: ArrayBuffer): number | null {
  try {
    const t = exifBlock(new DataView(bytes));
    if (!t) return null;
    const order = t.getUint16(0);
    if (order !== 0x4949 && order !== 0x4d4d) return null; // "II" = little-endian, "MM" = big-endian
    const little = order === 0x4949;
    if (t.getUint16(2, little) !== 42) return null;
    const pointer = findEntry(t, t.getUint32(4, little), 0x8769, little); // main directory → Exif directory
    if (pointer === null) return null;
    const exif = t.getUint32(pointer + 8, little);
    const m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(entryText(t, findEntry(t, exif, 0x9003, little), little));
    if (!m) return null;
    const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
    // A camera whose clock was never set writes zeros.
    if (y < 1970 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
    // "5" means half a second, "123456" 123 ms: the digits are a decimal fraction.
    const fraction = /^\d+/.exec(entryText(t, findEntry(t, exif, 0x9291, little), little));
    const ms = fraction ? Number(`${fraction[0]}00`.slice(0, 3)) : 0;
    return new Date(y, mo - 1, d, h, mi, s, ms).getTime();
  } catch {
    return null;
  }
}

/**
 * Oldest first, when every item knows when it was taken; otherwise exactly as given (a partial order would shuffle
 * the ones without a time into the wrong poses).
 */
export function inCaptureOrder<T extends { takenAt: number | null }>(items: T[]): T[] {
  if (items.some((i) => i.takenAt === null)) return [...items];
  return [...items].sort((a, b) => (a.takenAt ?? 0) - (b.takenAt ?? 0));
}

/* ---------- shrinking a photo ---------- */

/**
 * The picture as an <img>. Every current browser turns one upright by itself (phones store photos sideways, with a
 * note in the EXIF saying how to turn them), and can decode straight to a smaller size when it is drawn small,
 * where createImageBitmap would first have to hold all 12 to 48 megapixels in memory.
 */
function decode(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(CANT_OPEN));
    img.src = url;
  });
}

/** Draw onto a white canvas whose long edge is at most `edge`. Never enlarges. */
function shrink(image: CanvasImageSource, w: number, h: number, edge: number): HTMLCanvasElement {
  const scale = Math.min(1, edge / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(CANT_OPEN);
  ctx.fillStyle = "#fff"; // JPEG has no transparency: without this a see-through PNG comes out black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(CANT_OPEN))), "image/jpeg", quality));
}

/**
 * Turn a picked or just-taken picture into what is stored: an upright JPEG and a thumbnail. Redrawing it also drops
 * everything else the camera wrote into the file (where it was taken, which phone), so only the capture time is
 * read out first.
 */
export async function preparePhoto(file: Blob): Promise<Prepared> {
  const takenAt = await file
    .slice(0, EXIF_BYTES)
    .arrayBuffer()
    .then(exifTakenAt, () => null);
  const url = URL.createObjectURL(file);
  const canvases: HTMLCanvasElement[] = [];
  try {
    const img = await decode(url);
    if (!img.naturalWidth || !img.naturalHeight) throw new Error(CANT_OPEN);
    const big = shrink(img, img.naturalWidth, img.naturalHeight, FULL_EDGE);
    canvases.push(big);
    // From the already-shrunk picture: quicker, and smoother than one jump down from twelve megapixels.
    const small = shrink(big, big.width, big.height, THUMB_EDGE);
    canvases.push(small);
    return { full: await toJpeg(big, FULL_QUALITY), thumb: await toJpeg(small, THUMB_QUALITY), w: big.width, h: big.height, takenAt };
  } catch {
    throw new Error(CANT_OPEN); // a format this browser can't read (HEIC in Chrome), or not a picture at all
  } finally {
    URL.revokeObjectURL(url);
    // iOS gives a page only so much canvas memory and is slow to take it back; emptying them returns it now.
    for (const c of canvases) c.width = c.height = 0;
  }
}

/* ---------- on this device ---------- */

const DB_NAME = "hugo-photos";
/** id → sealed thumbnail. Named after the size, so a `Size` is also the name of its store. */
const THUMB: Size = "thumb";
/** id → sealed full-size photo. */
const FULL: Size = "full";
/** When each full-size copy was last opened, which decides the ones to drop. Kept apart so noting it doesn't rewrite the photo. */
const USED = "used";
/** Photos saved on this device that haven't reached the cloud yet. */
const QUEUE = "queue";
const EVERYTHING = [THUMB, FULL, USED, QUEUE];

type Stamp = { id: string; at: number };

/** Opened for each use and closed again, like media.ts: iOS drops connections that are held while the app sleeps. */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      for (const name of [THUMB, FULL]) req.result.createObjectStore(name);
      for (const name of [USED, QUEUE]) req.result.createObjectStore(name, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** One all-or-nothing transaction. Resolves once it is written, with the result of the request `run` returns (if any). */
async function tx<T>(stores: string[], mode: IDBTransactionMode, run: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const t = db.transaction(stores, mode);
      let req: IDBRequest<T> | void;
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
      try {
        req = run(t);
      } catch (e) {
        t.abort(); // don't let half of it through
        throw e;
      }
    });
  } finally {
    db.close();
  }
}

/** Throws when the device's storage can't be read, which is not the same as "isn't there" (undefined). */
const read = (size: Size, id: string) => tx<string | undefined>([size], "readonly", (t) => t.objectStore(size).get(id));

/** Ids deleted since the app opened, so a download or upload that was already under way can't bring one back. */
const removed = new Set<string>();

/** Note that a full-size copy was just opened, if it is still there: a stamp without a copy would take up one of the KEEP_FULL places. */
async function touch(id: string): Promise<void> {
  try {
    await tx([FULL, USED], "readwrite", (t) => {
      const there = t.objectStore(FULL).getKey(id);
      there.onsuccess = () => {
        if (there.result !== undefined) t.objectStore(USED).put({ id, at: Date.now() } satisfies Stamp);
      };
    });
  } catch {
    /* it only decides which copies are dropped first */
  }
}

/** Keep what was just downloaded. Best effort: without it the photo simply downloads again next time. */
async function keepCopy(size: Size, id: string, sealed: string): Promise<void> {
  if (removed.has(id)) return;
  try {
    await tx([size, USED], "readwrite", (t) => {
      t.objectStore(size).put(sealed, id);
      if (size === FULL) t.objectStore(USED).put({ id, at: Date.now() } satisfies Stamp);
    });
    if (size === FULL) await prune();
  } catch {
    /* no room, or private mode */
  }
}

/** Drop the full-size copies beyond the most recently opened KEEP_FULL: they download again when wanted. */
async function prune(): Promise<void> {
  if (!canUpload()) return; // local-only: the copy on this device is the only one there is
  try {
    await tx([FULL, USED, QUEUE], "readwrite", (t) => {
      const used = t.objectStore(USED).getAll() as IDBRequest<Stamp[]>;
      const queued = t.objectStore(QUEUE).getAllKeys();
      // Requests finish in the order they were made, so by now `used` has its answer too.
      queued.onsuccess = () => {
        const waiting = new Set(queued.result); // not uploaded yet: this is still the only copy
        for (const { id } of used.result.sort((a, b) => b.at - a.at).slice(KEEP_FULL)) {
          if (waiting.has(id)) continue;
          t.objectStore(FULL).delete(id);
          t.objectStore(USED).delete(id);
        }
      };
    });
  } catch {
    /* try again after the next photo */
  }
}

/** How many photos have a copy (thumbnail, full size or both) on this device. */
export async function devicePhotoCount(): Promise<number> {
  const ids = new Set<IDBValidKey>();
  try {
    await tx([THUMB, FULL], "readonly", (t) => {
      for (const size of [THUMB, FULL]) {
        const keys = t.objectStore(size).getAllKeys();
        keys.onsuccess = () => keys.result.forEach((k) => ids.add(k));
      }
    });
  } catch {
    return 0;
  }
  return ids.size;
}

/* ---------- the cloud ---------- */

const PART = { thumb: "t", full: "f" } as const;
const cloudPath = (id: string) => `${DATA_PATH}/body/${id}`;

async function upload(id: string, size: Size, sealed: string): Promise<void> {
  await request(`${DB_URL}/${cloudPath(id)}/${PART[size]}.json?print=silent`, { method: "PUT", body: JSON.stringify(sealed), headers: { "Content-Type": "application/json" } });
}

async function download(id: string, size: Size): Promise<string> {
  if (!canUpload()) throw new Error("This photo isn't on this device.");
  let value: unknown;
  try {
    value = await (await request(`${DB_URL}/${cloudPath(id)}/${PART[size]}.json`, { method: "GET" })).json();
  } catch {
    throw new Error("Couldn't load this photo. Check your connection.");
  }
  // The label reaches the other devices at once; the photo itself follows a few seconds later.
  if (typeof value !== "string" || !value) throw new Error("Still uploading from your other device.");
  return value;
}

/* ---------- saving ---------- */

/**
 * Encrypt a prepared photo and keep it. Resolves as soon as it is safely on this device; the upload carries on (or
 * waits for a connection) in the background. A replacement is a new photo with a new id.
 */
export async function savePhoto(key: CryptoKey, p: Prepared): Promise<PhotoMeta> {
  const id = uid();
  const at = Date.now();
  const thumb = await seal(key, await p.thumb.arrayBuffer());
  const full = await seal(key, await p.full.arrayBuffer());
  const meta: PhotoMeta = { id, at, w: p.w, h: p.h, bytes: p.full.size };
  try {
    await tx(EVERYTHING, "readwrite", (t) => {
      t.objectStore(THUMB).put(thumb, id);
      t.objectStore(FULL).put(full, id);
      t.objectStore(USED).put({ id, at } satisfies Stamp);
      if (canUpload()) t.objectStore(QUEUE).put({ id, at } satisfies Stamp);
    });
  } catch {
    // Nowhere to keep it here (private browsing, or the device is full), so it has to reach the cloud right now.
    if (!canUpload()) throw new Error("Couldn't save this photo: this browser has nowhere to keep it.");
    try {
      await upload(id, THUMB, thumb);
      await upload(id, FULL, full);
    } catch {
      await removePath(cloudPath(id)); // don't leave half a photo behind
      throw new Error("Couldn't save this photo. Check your connection and try again.");
    }
    return meta;
  }
  void flushPhotos();
  void prune();
  return meta;
}

let flushing: Promise<number> | null = null;
let again = false;

/** One pass over the queue, oldest first. Resolves with how many photos are still waiting. Never throws. */
async function flushOnce(): Promise<number> {
  if (!canUpload()) return 0;
  let queue: Stamp[];
  try {
    queue = (await tx<Stamp[]>([QUEUE], "readonly", (t) => t.objectStore(QUEUE).getAll())) ?? [];
  } catch {
    return 0; // no storage on this device, so nothing can be waiting in it
  }
  let left = queue.length;
  for (const { id } of queue.sort((a, b) => a.at - b.at)) {
    try {
      const thumb = await read(THUMB, id);
      const full = await read(FULL, id);
      if (thumb && full && !removed.has(id)) {
        await upload(id, THUMB, thumb); // first, so the other devices' grids fill in early
        await upload(id, FULL, full);
      }
      await tx([QUEUE], "readwrite", (t) => t.objectStore(QUEUE).delete(id));
      if (removed.has(id)) await removePath(cloudPath(id)); // deleted while it was on its way up
      left--;
    } catch {
      /* offline, or the upload failed: it stays queued for next time */
    }
  }
  return left;
}

/**
 * Upload everything still waiting; resolves with how many photos are left in the queue. Call it when the app opens
 * and when the connection returns. Only one run at a time: calling it during a run makes that run go round once
 * more (something may have been queued behind its back) and hands back the same promise.
 */
export function flushPhotos(): Promise<number> {
  if (flushing) {
    again = true;
    return flushing;
  }
  flushing = (async () => {
    try {
      let left: number;
      do {
        again = false;
        left = await flushOnce();
      } while (again);
      return left;
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

/* ---------- loading ---------- */

const loading = new Map<string, Promise<Blob>>();

async function unlock(key: CryptoKey, id: string, size: Size): Promise<Blob> {
  const onDevice = await read(size, id).catch(() => undefined);
  const sealed = onDevice ?? (await download(id, size));
  let jpeg: ArrayBuffer;
  try {
    jpeg = await unseal(key, sealed);
  } catch {
    throw new Error("This photo can't be unlocked on this device.");
  }
  // Only once it has unlocked: a download that was damaged or tampered with must not become this device's copy.
  if (!onDevice) void keepCopy(size, id, sealed);
  else if (size === FULL) void touch(id);
  return new Blob([jpeg], { type: "image/jpeg" });
}

/**
 * The decrypted JPEG. From this device when it has a copy, otherwise downloaded (and a copy kept). Several callers
 * asking for the same photo at once share one load.
 */
export function loadPhoto(key: CryptoKey, meta: PhotoMeta, size: Size): Promise<Blob> {
  const slot = `${meta.id}/${size}`;
  let running = loading.get(slot);
  if (!running) {
    running = unlock(key, meta.id, size).finally(() => loading.delete(slot));
    loading.set(slot, running);
  }
  return running;
}

/** Delete a photo everywhere this device can reach: its copies here, its place in the queue, and the cloud's. */
export async function removePhoto(id: string): Promise<void> {
  removed.add(id);
  try {
    await tx(EVERYTHING, "readwrite", (t) => EVERYTHING.forEach((name) => void t.objectStore(name).delete(id)));
  } catch {
    /* no storage on this device: nothing of it was here */
  }
  // Ids are letters and digits; anything else would make the address below point somewhere it shouldn't.
  if (/^[a-z0-9]+$/i.test(id)) await removePath(cloudPath(id));
}
