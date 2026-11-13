"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { goOffline, goOnline, onValue, ref, remove, set, update } from "firebase/database";
import type { AppData, DayRecord, HabitDef, Settings, VoiceMeta } from "./types";
import { materializeDay, normalizeData, normalizeDays, normalizeSettings, stripUndefined, uid } from "./model";
import { todayKey } from "./dates";
import { DEFAULT_HABITS, MAX_HABITS, START_DATE } from "./defaults";
import { SOUND_IDS, isSound } from "./sounds";
import { cached, canUpload, forget, getPieces, keep, putPieces, removePath, storageAvailable, toChunks } from "./media";
import { type PendingVoice, dropPending, getPending, listPending, putPending, voicePath } from "./voice";
import { DATA_PATH, getDb } from "./firebase";

export type SyncState = "local" | "connecting" | "online" | "offline";
/** A voice recording on this device that hasn't finished uploading. */
export type VoiceProgress = { date: string; at: number; dur: number; uploaded: number; total: number; state: "uploading" | "waiting" };

const LS_KEY = "locked-in:data:v1";
const OUTBOX_KEY = "locked-in:outbox:v1";

type Store = {
  data: AppData;
  loaded: boolean;
  today: string;
  sync: SyncState;
  pending: number;
  getDay: (date: string) => DayRecord;
  updateDay: (date: string, fn: (day: DayRecord) => DayRecord) => void;
  updateSettings: (fn: (s: Settings) => Settings) => void;
  /** The voice journal: saved on this device straight away, uploaded in the background. */
  voicePending: Record<string, VoiceProgress>;
  saveVoice: (date: string, audio: Blob, seconds: number) => Promise<void>;
  loadVoice: (date: string, id: string) => Promise<Blob>;
  removeVoice: (date: string, id: string) => Promise<void>;
};

/** Exactly ten habits, the must-do (No gooning) on top, no times, and a different sound on each. */
function upgrade(s: Settings): Settings {
  if (!s.v3) {
    return { ...s, v3: true, v4: true, startDate: s.startDate ?? START_DATE, habitsArchive: s.habitsArchive ?? s.habits, habits: DEFAULT_HABITS.map((h) => ({ ...h })) };
  }
  if (s.v4) return s;
  let habits: HabitDef[] = s.habits.slice(0, MAX_HABITS).map((h) => {
    const next = { ...h };
    delete next.time;
    return next;
  });
  for (const d of DEFAULT_HABITS) if (habits.length < MAX_HABITS && !habits.some((h) => h.id === d.id)) habits.push({ ...d });
  const goon = habits.findIndex((h) => h.id === "sc-nogoon");
  if (goon > 0) habits = [habits[goon], ...habits.slice(0, goon), ...habits.slice(goon + 1)];
  const used = new Set<string>();
  habits = habits.map((h) => {
    if (isSound(h.sound) && !used.has(h.sound)) {
      used.add(h.sound);
      return h;
    }
    const preferred = DEFAULT_HABITS.find((d) => d.id === h.id)?.sound;
    const sound = preferred && !used.has(preferred) ? preferred : (SOUND_IDS.find((id) => !used.has(id)) ?? SOUND_IDS[0]);
    used.add(sound);
    return { ...h, sound };
  });
  return { ...s, v4: true, startDate: s.startDate ?? START_DATE, habits };
}

const StoreContext = createContext<Store | null>(null);

function readCache(): AppData | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? normalizeData(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(data: AppData) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    /* storage full or unavailable: ignore */
  }
}

/* ---------- offline outbox: remote writes survive the app being closed while offline ---------- */

type OutboxItem = { id: string; kind: "set" | "update" | "remove"; path: string; value?: unknown; at: number };

function readOutbox(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    const list = raw ? (JSON.parse(raw) as OutboxItem[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: OutboxItem[]) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(() => normalizeData(null));
  const [loaded, setLoaded] = useState(false);
  const [today, setToday] = useState("");
  const [sync, setSync] = useState<SyncState>("local");
  const [pending, setPending] = useState(0);
  // True once the cloud copy of the settings has arrived (or there is no cloud), so the one-time habit swap never acts on a stale cache.
  const [settingsReady, setSettingsReady] = useState(false);
  const dataRef = useRef(data);
  const todayRef = useRef(today);
  const dbRef = useRef<ReturnType<typeof getDb>>(null);

  const commit = useCallback((next: AppData) => {
    dataRef.current = next;
    setData(next);
    writeCache(next);
  }, []);

  /* ---- remote writes with the outbox ---- */

  const flushing = useRef(false);
  const flushOutbox = useCallback(async () => {
    const db = dbRef.current;
    if (!db || flushing.current) return;
    flushing.current = true;
    try {
      let items = readOutbox();
      while (items.length) {
        const item = items[0];
        try {
          if (item.kind === "set") await set(ref(db, item.path), item.value);
          else if (item.kind === "update") await update(ref(db, item.path), item.value as Record<string, unknown>);
          else await remove(ref(db, item.path));
        } catch {
          break; // still offline (or rejected): try again on the next connection
        }
        items = readOutbox().filter((i) => i.id !== item.id);
        writeOutbox(items);
        setPending(items.length);
      }
    } finally {
      flushing.current = false;
    }
  }, []);

  const remote = useCallback(
    (kind: OutboxItem["kind"], path: string, value?: unknown) => {
      const db = dbRef.current;
      if (!db) return;
      const item: OutboxItem = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, kind, path, value, at: Date.now() };
      const items = [...readOutbox(), item];
      writeOutbox(items);
      setPending(items.length);
      void flushOutbox();
    },
    [flushOutbox],
  );

  useEffect(() => {
    const tick = () => {
      const t = todayKey();
      todayRef.current = t;
      setToday(t);
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    // Deferred so the first paint isn't blocked and React doesn't see a synchronous setState in an effect.
    const start = window.setTimeout(() => {
      const cached = readCache();
      if (cached) {
        dataRef.current = cached;
        setData(cached);
      }
      setLoaded(true);
      setPending(readOutbox().length);

      const db = getDb();
      if (!db) {
        setSettingsReady(true);
        return;
      }
      dbRef.current = db;
      setSync("connecting");

      // Days and settings are listened to separately, so nothing large (photos, videos) ever rides along.
      let firstDays = true;
      unsubs.push(
        onValue(
          ref(db, `${DATA_PATH}/days`),
          (snap) => {
            if (firstDays && !snap.exists() && Object.keys(dataRef.current.days).length > 0) {
              firstDays = false;
              set(ref(db, `${DATA_PATH}/days`), dataRef.current.days).catch(() => undefined);
              return;
            }
            firstDays = false;
            commit({ ...dataRef.current, days: normalizeDays(snap.val()) });
          },
          () => setSync("offline"),
        ),
      );
      unsubs.push(
        onValue(
          ref(db, `${DATA_PATH}/settings`),
          (snap) => {
            if (snap.exists()) commit({ ...dataRef.current, settings: normalizeSettings(snap.val()) });
            setSettingsReady(true);
          },
          () => setSettingsReady(true),
        ),
      );
      unsubs.push(
        onValue(ref(db, ".info/connected"), (snap) => {
          const on = Boolean(snap.val());
          setSync(on ? "online" : "offline");
          if (on) void flushOutbox();
        }),
      );
    }, 0);

    return () => {
      window.clearTimeout(start);
      unsubs.forEach((u) => u());
    };
  }, [commit, flushOutbox]);

  const getDay = useCallback((date: string) => materializeDay(date, data.days[date], data.settings, today || date), [data, today]);

  const updateDay = useCallback(
    (date: string, fn: (day: DayRecord) => DayRecord) => {
      const prev = dataRef.current;
      const current = materializeDay(date, prev.days[date], prev.settings, todayRef.current || date);
      const nextDay: DayRecord = stripUndefined({ ...fn(current), date, updatedAt: Date.now() }); // Firebase rejects undefined values
      commit({ ...prev, days: { ...prev.days, [date]: nextDay } });
      remote("set", `${DATA_PATH}/days/${date}`, nextDay);
    },
    [commit, remote],
  );

  const updateSettings = useCallback(
    (fn: (s: Settings) => Settings) => {
      const prev = dataRef.current;
      const next = fn(prev.settings);
      const settings: Settings = stripUndefined(next);
      commit({ ...prev, settings });
      remote("set", `${DATA_PATH}/settings`, settings);
    },
    [commit, remote],
  );

  // One time only, once the cloud copy of the settings is in: bring the habits up to date (see upgrade()).
  useEffect(() => {
    if (!settingsReady) return;
    const s = dataRef.current.settings;
    if (s.v3 && s.v4) return;
    const id = window.setTimeout(() => updateSettings(upgrade), 0);
    return () => window.clearTimeout(id);
  }, [settingsReady, updateSettings]);

  /* ---- the voice journal ---- */

  const [voicePending, setVoicePending] = useState<Record<string, VoiceProgress>>({});
  const voiceRunning = useRef(false);
  const voiceAgain = useRef(false);

  /** Upload whatever recordings on this device haven't gone up yet, then put their labels on their days. */
  const runVoiceQueue = useCallback(async () => {
    if (!storageAvailable()) return;
    if (voiceRunning.current) {
      voiceAgain.current = true;
      return;
    }
    voiceRunning.current = true;
    try {
      do {
        voiceAgain.current = false;
        const queue = await listPending();
        const ids = new Set(queue.map((p) => p.id));
        setVoicePending((m) => (Object.keys(m).every((k) => ids.has(k)) ? m : Object.fromEntries(Object.entries(m).filter(([k]) => ids.has(k)))));
        for (const p of queue) {
          const show = (uploaded: number, state: VoiceProgress["state"]) =>
            setVoicePending((m) => ({ ...m, [p.id]: { date: p.date, at: p.at, dur: p.dur, uploaded, total: p.chunks.length, state } }));
          try {
            if (canUpload() && p.uploaded < p.chunks.length) {
              show(p.uploaded, "uploading");
              await putPieces(voicePath(p.date, p.id), p.chunks, p.uploaded, async (n) => {
                const current = await getPending(p.id);
                if (!current) throw new Error("removed");
                await putPending({ ...current, uploaded: n });
                show(n, "uploading");
              });
            }
          } catch (e) {
            if (!(e instanceof Error && e.message === "removed")) show(p.uploaded, "waiting"); // offline: tried again later
            continue;
          }
          if (!(await getPending(p.id))) continue; // deleted while uploading
          const meta: VoiceMeta = { at: p.at, dur: p.dur, bytes: p.bytes, chunks: p.chunks.length, mime: p.mime };
          updateDay(p.date, (d) => ({ ...d, voice: { ...(d.voice ?? {}), [p.id]: meta } }));
          await keep(`voice:${p.id}`, p.chunks);
          await dropPending(p.id);
          setVoicePending((m) => {
            const next = { ...m };
            delete next[p.id];
            return next;
          });
        }
      } while (voiceAgain.current);
    } finally {
      voiceRunning.current = false;
    }
  }, [updateDay]);

  // Pick the queue up when the app opens and whenever the connection comes back; retry every half minute if stuck.
  useEffect(() => {
    if (!loaded) return;
    const id = window.setTimeout(() => void runVoiceQueue(), 0);
    return () => window.clearTimeout(id);
  }, [loaded, sync, runVoiceQueue]);
  const voiceWaiting = Object.values(voicePending).some((v) => v.state === "waiting");
  useEffect(() => {
    if (!voiceWaiting) return;
    const id = window.setInterval(() => void runVoiceQueue(), 30_000);
    return () => window.clearInterval(id);
  }, [voiceWaiting, runVoiceQueue]);

  const saveVoice = useCallback(
    async (date: string, audio: Blob, seconds: number) => {
      const chunks = await toChunks(audio);
      if (!chunks.length) throw new Error("That recording was empty.");
      const p: PendingVoice = { id: uid(), date, at: Date.now(), dur: Math.round(seconds), bytes: audio.size, mime: (audio.type || "audio/mp4").split(";")[0], chunks, uploaded: 0 };
      try {
        await putPending(p);
      } catch {
        throw new Error("This device couldn't store the recording (storage may be full, or this is a private window).");
      }
      setVoicePending((m) => ({ ...m, [p.id]: { date, at: p.at, dur: p.dur, uploaded: 0, total: chunks.length, state: "uploading" } }));
      void runVoiceQueue();
    },
    [runVoiceQueue],
  );

  const loadVoice = useCallback(async (date: string, id: string): Promise<Blob> => {
    const pending = await getPending(id);
    if (pending) return new Blob(pending.chunks, { type: pending.mime });
    const meta = dataRef.current.days[date]?.voice?.[id];
    if (!meta) throw new Error("That recording isn't here any more.");
    let chunks = await cached(`voice:${id}`, meta.chunks);
    if (!chunks) {
      try {
        chunks = await getPieces(voicePath(date, id), meta.chunks);
      } catch {
        throw new Error("Couldn't download this recording. Check your connection.");
      }
      void keep(`voice:${id}`, chunks);
    }
    return new Blob(chunks, { type: meta.mime });
  }, []);

  const removeVoice = useCallback(
    async (date: string, id: string) => {
      await dropPending(id);
      await forget(`voice:${id}`);
      setVoicePending((m) => {
        if (!(id in m)) return m;
        const next = { ...m };
        delete next[id];
        return next;
      });
      if (dataRef.current.days[date]?.voice?.[id]) {
        updateDay(date, (d) => {
          const voice = { ...(d.voice ?? {}) };
          delete voice[id];
          return { ...d, voice: Object.keys(voice).length ? voice : undefined };
        });
      }
      await removePath(voicePath(date, id));
    },
    [updateDay],
  );

  // Dev-only hooks so offline sync can be exercised from the console.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as Record<string, unknown>).__lockedInDev = {
      goOffline: () => dbRef.current && goOffline(dbRef.current),
      goOnline: () => dbRef.current && goOnline(dbRef.current),
      outbox: () => readOutbox().length,
    };
  }, []);

  const value = useMemo<Store>(
    () => ({ data, loaded, today, sync, pending, getDay, updateDay, updateSettings, voicePending, saveVoice, loadVoice, removeVoice }),
    [data, loaded, today, sync, pending, getDay, updateDay, updateSettings, voicePending, saveVoice, loadVoice, removeVoice],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside AppProviders");
  return ctx;
}
