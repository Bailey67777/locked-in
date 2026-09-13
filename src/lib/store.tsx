"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onValue, ref, set } from "firebase/database";
import type { AppData, DayRecord, Settings } from "./types";
import { materializeDay, normalizeData } from "./model";
import { addDays, todayKey } from "./dates";
import { DATA_PATH, getDb } from "./firebase";

export type SyncState = "local" | "connecting" | "online" | "offline";

const LS_KEY = "locked-in:data:v1";

type Store = {
  data: AppData;
  loaded: boolean;
  today: string;
  sync: SyncState;
  getDay: (date: string) => DayRecord;
  updateDay: (date: string, fn: (day: DayRecord) => DayRecord) => void;
  updateSettings: (fn: (s: Settings) => Settings) => void;
  carryTodoOver: (date: string, todoId: string) => void;
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
    let unsubData: (() => void) | null = null;
    let unsubConn: (() => void) | null = null;

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

      let first = true;
      unsubData = onValue(
        ref(db, DATA_PATH),
        (snap) => {
          if (first && !snap.exists() && Object.keys(dataRef.current.days).length > 0) {
            // Cloud is empty but this device has history: seed the cloud from it.
            first = false;
            set(ref(db, DATA_PATH), dataRef.current).catch(() => undefined);
            return;
          }
          first = false;
          commit(normalizeData(snap.val()));
        },
        () => setSync("offline"),
      );
      unsubConn = onValue(ref(db, ".info/connected"), (snap) => {
        setSync(snap.val() ? "online" : "offline");
      });
    }, 0);

    return () => {
      window.clearTimeout(start);
      unsubData?.();
      unsubConn?.();
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
      commit({ ...prev, days: { ...prev.days, [date]: nextDay } });
      pushDay(date, nextDay);
    },
    [commit, pushDay],
  );

  const updateSettings = useCallback(
    (fn: (s: Settings) => Settings) => {
      const prev = dataRef.current;
      const settings = fn(prev.settings);
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

  const value = useMemo<Store>(
    () => ({ data, loaded, today, sync, getDay, updateDay, updateSettings, carryTodoOver }),
    [data, loaded, today, sync, getDay, updateDay, updateSettings, carryTodoOver],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside AppProviders");
  return ctx;
}
