"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { goOffline, goOnline, onValue, ref, remove, set, update } from "firebase/database";
import type { AppData, DayRecord, Settings } from "./types";
import { materializeDay, normalizeData, normalizeDays, normalizeSettings, stripUndefined } from "./model";
import { todayKey } from "./dates";
import { DEFAULT_HABITS } from "./defaults";
import { DATA_PATH, getDb } from "./firebase";

export type SyncState = "local" | "connecting" | "online" | "offline";

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
};

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

  // One time only: switch to the ten habits. The old list is kept in settings.habitsArchive.
  useEffect(() => {
    if (!settingsReady || dataRef.current.settings.v3) return;
    const id = window.setTimeout(() => {
      updateSettings((s) => (s.v3 ? s : { ...s, v3: true, habitsArchive: s.habitsArchive ?? s.habits, habits: DEFAULT_HABITS.map((h) => ({ ...h })) }));
    }, 0);
    return () => window.clearTimeout(id);
  }, [settingsReady, updateSettings]);

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
    () => ({ data, loaded, today, sync, pending, getDay, updateDay, updateSettings }),
    [data, loaded, today, sync, pending, getDay, updateDay, updateSettings],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside AppProviders");
  return ctx;
}
