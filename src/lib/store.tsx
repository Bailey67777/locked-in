"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { get, onValue, ref, remove, set } from "firebase/database";
import type { AppData, DayRecord, Settings } from "./types";
import { materializeDay, normalizeData, normalizeDays, normalizeSettings, sortHabits } from "./model";
import { addDays, todayKey } from "./dates";
import { DATA_PATH, getDb } from "./firebase";

export type SyncState = "local" | "connecting" | "online" | "offline";

const LS_KEY = "locked-in:data:v1";
const PHOTO_KEY = (date: string) => `locked-in:photo:${date}`;

type Store = {
  data: AppData;
  loaded: boolean;
  today: string;
  sync: SyncState;
  getDay: (date: string) => DayRecord;
  updateDay: (date: string, fn: (day: DayRecord) => DayRecord) => void;
  updateSettings: (fn: (s: Settings) => Settings) => void;
  carryTodoOver: (date: string, todoId: string) => void;
  /** Full-size (well, 720px) photo for a day; fetched on demand, not kept in the main data. */
  getDayPhoto: (date: string) => Promise<string | null>;
  setDayPhoto: (date: string, photo: { medium: string; thumb: string }) => Promise<void>;
  removeDayPhoto: (date: string) => Promise<void>;
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

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(() => normalizeData(null));
  const [loaded, setLoaded] = useState(false);
  const [today, setToday] = useState("");
  const [sync, setSync] = useState<SyncState>("local");
  const dataRef = useRef(data);
  const todayRef = useRef(today);
  const dbRef = useRef<ReturnType<typeof getDb>>(null);

  const commit = useCallback((next: AppData) => {
    dataRef.current = next;
    setData(next);
    writeCache(next);
  }, []);

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

      const db = getDb();
      if (!db) return;
      dbRef.current = db;
      setSync("connecting");

      // Days and settings are listened to separately so photos (stored under /photos) never ride along.
      let firstDays = true;
      unsubs.push(
        onValue(
          ref(db, `${DATA_PATH}/days`),
          (snap) => {
            if (firstDays && !snap.exists() && Object.keys(dataRef.current.days).length > 0) {
              // Cloud is empty but this device has history: seed the cloud from it.
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
        onValue(ref(db, `${DATA_PATH}/settings`), (snap) => {
          if (!snap.exists()) return; // keep local/default settings until something is saved
          commit({ ...dataRef.current, settings: normalizeSettings(snap.val()) });
        }),
      );
      unsubs.push(
        onValue(ref(db, ".info/connected"), (snap) => {
          setSync(snap.val() ? "online" : "offline");
        }),
      );
    }, 0);

    return () => {
      window.clearTimeout(start);
      unsubs.forEach((u) => u());
    };
  }, [commit]);

  const pushDay = useCallback((date: string, day: DayRecord) => {
    const db = dbRef.current;
    if (!db) return;
    set(ref(db, `${DATA_PATH}/days/${date}`), day).catch(() => undefined);
  }, []);

  const getDay = useCallback(
    (date: string) => materializeDay(date, data.days[date], data.settings, today || date),
    [data, today],
  );

  const updateDay = useCallback(
    (date: string, fn: (day: DayRecord) => DayRecord) => {
      const prev = dataRef.current;
      const current = materializeDay(date, prev.days[date], prev.settings, todayRef.current || date);
      const nextDay: DayRecord = { ...fn(current), date, updatedAt: Date.now() };
      if (!nextDay.thumb) delete nextDay.thumb; // Firebase rejects undefined values
      commit({ ...prev, days: { ...prev.days, [date]: nextDay } });
      pushDay(date, nextDay);
    },
    [commit, pushDay],
  );

  const updateSettings = useCallback(
    (fn: (s: Settings) => Settings) => {
      const prev = dataRef.current;
      const next = fn(prev.settings);
      // Strip undefined fields (Firebase rejects them) and keep timed habits in time order.
      const settings: Settings = {
        ...next,
        habits: sortHabits(
          next.habits.map((h) => {
            const clean = { ...h };
            (Object.keys(clean) as (keyof typeof clean)[]).forEach((k) => clean[k] === undefined && delete clean[k]);
            return clean;
          }),
        ),
      };
      commit({ ...prev, settings });
      const db = dbRef.current;
      if (db) set(ref(db, `${DATA_PATH}/settings`), settings).catch(() => undefined);
    },
    [commit],
  );

  const carryTodoOver = useCallback(
    (date: string, todoId: string) => {
      const day = materializeDay(date, dataRef.current.days[date], dataRef.current.settings, todayRef.current || date);
      const todo = day.todos.find((t) => t.id === todoId);
      if (!todo) return;
      updateDay(date, (d) => ({ ...d, todos: d.todos.filter((t) => t.id !== todoId) }));
      updateDay(addDays(date, 1), (d) => ({ ...d, todos: [...d.todos, { ...todo, done: false }] }));
    },
    [updateDay],
  );

  const getDayPhoto = useCallback(async (date: string): Promise<string | null> => {
    const db = dbRef.current;
    if (db) {
      try {
        const snap = await get(ref(db, `${DATA_PATH}/photos/${date}`));
        const v = snap.val() as { data?: string } | null;
        if (v?.data) return v.data;
      } catch {
        /* fall through to local */
      }
    }
    try {
      return localStorage.getItem(PHOTO_KEY(date));
    } catch {
      return null;
    }
  }, []);

  const setDayPhoto = useCallback(
    async (date: string, photo: { medium: string; thumb: string }) => {
      try {
        localStorage.setItem(PHOTO_KEY(date), photo.medium);
      } catch {
        /* quota: the thumbnail still lives in the day record */
      }
      updateDay(date, (d) => ({ ...d, thumb: photo.thumb }));
      const db = dbRef.current;
      if (db) await set(ref(db, `${DATA_PATH}/photos/${date}`), { data: photo.medium, updatedAt: Date.now() }).catch(() => undefined);
    },
    [updateDay],
  );

  const removeDayPhoto = useCallback(
    async (date: string) => {
      try {
        localStorage.removeItem(PHOTO_KEY(date));
      } catch {
        /* ignore */
      }
      updateDay(date, (d) => {
        const next = { ...d };
        delete next.thumb;
        return next;
      });
      const db = dbRef.current;
      if (db) await remove(ref(db, `${DATA_PATH}/photos/${date}`)).catch(() => undefined);
    },
    [updateDay],
  );

  const value = useMemo<Store>(
    () => ({ data, loaded, today, sync, getDay, updateDay, updateSettings, carryTodoOver, getDayPhoto, setDayPhoto, removeDayPhoto }),
    [data, loaded, today, sync, getDay, updateDay, updateSettings, carryTodoOver, getDayPhoto, setDayPhoto, removeDayPhoto],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside AppProviders");
  return ctx;
}
