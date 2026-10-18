"use client";

/**
 * The edit bank: short videos you upload once and attach to To Do items; ticking the item plays its edit.
 *
 * Each edit is stored like a vlog: pieces at /edits/<id>/<n>, a small label (name, length, a thumbnail) at
 * /editBank/<id>. Every edit that has played on a device is kept there too (IndexedDB), so it starts instantly.
 */
import { useSyncExternalStore } from "react";
import { onValue, ref, remove, set, update } from "firebase/database";
import { DATA_PATH, cloudConfigured, getDb } from "./firebase";
import type { EditMeta } from "./types";
import { normalizeEditMeta, uid } from "./model";
import { CHUNK_BYTES, DB_URL, EDIT_CACHE, getPieces, putPieces, tx, videoDuration } from "./vlog";

/** Biggest edit accepted. Edits are meant to be short; this keeps the free database from filling up. */
export const EDIT_MAX_BYTES = 30 * 1024 * 1024;
const CACHE_KEEP = 30;
const LS_KEY = "locked-in:edit-bank";
const BANK = `${DATA_PATH}/editBank`;
const piecesPath = (id: string) => `${DATA_PATH}/edits/${id}`;

/* ---------- the bank (labels), shared by every component through one listener ---------- */

export type EditBank = { list: EditMeta[]; byId: Record<string, EditMeta>; ready: boolean };
const EMPTY: EditBank = { list: [], byId: {}, ready: false };
let bank: EditBank = EMPTY;
const listeners = new Set<() => void>();
let started = false;

function make(list: EditMeta[], ready: boolean): EditBank {
  const sorted = [...list].sort((a, b) => (b.usedAt ?? b.at) - (a.usedAt ?? a.at));
  return { list: sorted, byId: Object.fromEntries(sorted.map((e) => [e.id, e])), ready };
}

function emit(next: EditBank) {
  bank = next;
  listeners.forEach((l) => l());
}

function normalizeBank(raw: unknown): EditMeta[] {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return Object.entries(obj)
    .map(([id, v]) => normalizeEditMeta(id, v))
    .filter((e): e is EditMeta => e !== null);
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  // The copy on this device shows straight away; the cloud copy replaces it as soon as it arrives.
  window.setTimeout(() => {
    let cached: EditMeta[] | null = null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      cached = raw ? normalizeBank(JSON.parse(raw)) : null;
    } catch {
      cached = null;
    }
    const db = getDb();
    if (!bank.ready) emit(make(cached ?? [], cached !== null || !db));
    if (!db) return;
    onValue(
      ref(db, BANK),
      (snap) => {
        const list = normalizeBank(snap.val());
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries(list.map((e) => [e.id, e]))));
        } catch {
          /* storage full: it loads from the cloud next time */
        }
        emit(make(list, true));
      },
      () => emit({ ...bank, ready: true }),
    );
  }, 0);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => listeners.delete(listener);
}

/** Every edit in the bank, most recently used first. */
export function useEditBank(): EditBank {
  return useSyncExternalStore(subscribe, () => bank, () => EMPTY);
}

/* ---------- uploading and deleting ---------- */

/** A small JPEG from about a third of the way in, for picking edits by sight. */
export function videoThumb(file: Blob): Promise<string | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    let settled = false;
    const finish = (r: string | undefined) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(r);
    };
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.onloadeddata = () => {
      v.currentTime = Math.min(1.5, (Number.isFinite(v.duration) ? v.duration : 3) / 3);
    };
    v.onseeked = () => {
      try {
        const w = 200;
        const h = Math.max(1, Math.round((v.videoHeight / Math.max(1, v.videoWidth)) * w));
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d")?.drawImage(v, 0, 0, w, h);
        finish(c.toDataURL("image/jpeg", 0.7));
      } catch {
        finish(undefined);
      }
    };
    v.onerror = () => finish(undefined);
    window.setTimeout(() => finish(undefined), 6000);
    v.src = url;
  });
}

/** Upload a video to the bank. Needs a connection; reports progress 0–1. */
export async function uploadEdit(file: File, onProgress?: (fraction: number) => void): Promise<EditMeta> {
  if (!file.type.startsWith("video/") && !/\.(mp4|mov|m4v|webm)$/i.test(file.name)) throw new Error("That isn't a video file.");
  if (file.size > EDIT_MAX_BYTES) throw new Error(`That video is ${Math.round(file.size / 1024 / 1024)} MB. Edits can be up to ${EDIT_MAX_BYTES / 1024 / 1024} MB, so trim it or pick a shorter one.`);
  const db = getDb();
  if (!db || !cloudConfigured || !DB_URL) throw new Error("Edits need the cloud sync to be set up.");
  const id = uid();
  const [dur, thumb] = await Promise.all([videoDuration(file), videoThumb(file)]);
  // iPhone videos arrive as QuickTime; labelled as MP4 they play on the laptop too.
  const mime = !file.type || file.type === "video/quicktime" ? "video/mp4" : file.type.split(";")[0];
  const chunks: ArrayBuffer[] = [];
  for (let offset = 0; offset < file.size; offset += CHUNK_BYTES) chunks.push(await file.slice(offset, offset + CHUNK_BYTES).arrayBuffer());
  try {
    await putPieces(piecesPath(id), chunks, 0, (n) => onProgress?.(n / chunks.length));
  } catch {
    remove(ref(db, piecesPath(id))).catch(() => undefined);
    throw new Error("The upload didn't finish. Check your connection and try again.");
  }
  const name = file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 60) || "Edit";
  const meta: EditMeta = { id, name, dur: Math.round(dur), bytes: file.size, chunks: chunks.length, mime, at: Date.now(), usedAt: Date.now(), ...(thumb ? { thumb } : {}) };
  await set(ref(db, `${BANK}/${id}`), { ...meta, id: null });
  await keep(id, chunks);
  emit(make([...bank.list.filter((e) => e.id !== id), meta], true));
  return meta;
}

export function renameEdit(id: string, name: string) {
  const db = getDb();
  const clean = name.trim().slice(0, 60);
  if (db && clean) update(ref(db, `${BANK}/${id}`), { name: clean }).catch(() => undefined);
}

/** Bump an edit to the front of the bank when it's attached to something. */
export function markEditUsed(id: string) {
  const db = getDb();
  if (db) update(ref(db, `${BANK}/${id}`), { usedAt: Date.now() }).catch(() => undefined);
}

export async function deleteEdit(id: string): Promise<void> {
  const db = getDb();
  emit(make(bank.list.filter((e) => e.id !== id), bank.ready));
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
  urls.delete(id);
  try {
    await tx(EDIT_CACHE, "readwrite", (s) => s.delete(id));
  } catch {
    /* ignore */
  }
  if (!db) return;
  await remove(ref(db, `${BANK}/${id}`)).catch(() => undefined);
  await remove(ref(db, piecesPath(id))).catch(() => undefined);
}

/* ---------- playing: ready-made links, kept for the session ---------- */

type Cached = { id: string; chunks: ArrayBuffer[]; at: number };
const urls = new Map<string, string>();
const loading = new Map<string, Promise<string>>();

async function keep(id: string, chunks: ArrayBuffer[]) {
  try {
    await tx(EDIT_CACHE, "readwrite", (s) => s.put({ id, chunks, at: Date.now() } satisfies Cached));
    const all = ((await tx<Cached[]>(EDIT_CACHE, "readonly", (s) => s.getAll())) as Cached[] | undefined) ?? [];
    const extra = all.sort((a, b) => b.at - a.at).slice(CACHE_KEEP);
    for (const e of extra) await tx(EDIT_CACHE, "readwrite", (s) => s.delete(e.id));
  } catch {
    /* no room: it downloads again next time */
  }
}

/** A link that plays right now, if this edit has already been loaded this session. */
export function editUrlNow(id: string): string | undefined {
  return urls.get(id);
}

/** Load an edit (from this device if it's here, otherwise the cloud) and return a playable link. */
export function loadEditUrl(meta: EditMeta, onProgress?: (fraction: number) => void): Promise<string> {
  const ready = urls.get(meta.id);
  if (ready) return Promise.resolve(ready);
  const running = loading.get(meta.id);
  if (running) return running;
  const job = (async () => {
    let chunks: ArrayBuffer[] | null = null;
    try {
      const hit = (await tx<Cached>(EDIT_CACHE, "readonly", (s) => s.get(meta.id))) as Cached | undefined;
      if (hit && hit.chunks.length === meta.chunks) chunks = hit.chunks;
    } catch {
      chunks = null;
    }
    if (!chunks) {
      if (!DB_URL) throw new Error("This edit isn't on this device.");
      try {
        chunks = await getPieces(piecesPath(meta.id), meta.chunks, onProgress);
      } catch {
        throw new Error("Couldn't download this edit. Check your connection.");
      }
      void keep(meta.id, chunks);
    }
    const url = URL.createObjectURL(new Blob(chunks, { type: meta.mime }));
    urls.set(meta.id, url);
    return url;
  })().finally(() => loading.delete(meta.id));
  loading.set(meta.id, job);
  return job;
}

/** Get these edits ready in the background, one at a time, so ticking an item plays its edit straight away. */
export function prewarmEdits(metas: EditMeta[]): void {
  const todo = metas.filter((m) => !urls.has(m.id));
  const next = () => {
    const m = todo.shift();
    if (!m) return;
    loadEditUrl(m)
      .catch(() => undefined)
      .then(() => window.setTimeout(next, 200));
  };
  if (todo.length) window.setTimeout(next, 800);
}
