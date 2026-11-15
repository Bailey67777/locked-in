"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { onValue, ref, set } from "firebase/database";
import type { HubData } from "./types";
import { normalizeData } from "./model";
import { todayKey } from "../dates";
import { DATA_PATH, getDb } from "../firebase";

/**
 * The Academics, Health and To-do data: one small tree at <space>/hub, kept in step across devices. The habits keep
 * their own store (src/lib/store.tsx) untouched. Nothing large lives here: photo files are stored apart.
 */

export const HUB_PATH = `${DATA_PATH}/hub`;

const LS_KEY = "locked-in:hub:v1";
const OUTBOX_KEY = "locked-in:hub-outbox:v1";

type Hub = {
  data: HubData;
  loaded: boolean;
  /** True once the cloud copy has arrived (or there is no cloud): safe to decide something isn't set yet. */
  fresh: boolean;
  today: string;
  /** Ticks every second while a study timer is running, every 30 s otherwise. */
  now: number;
  online: boolean;
  /** Write a value (null deletes) at a path under the hub, e.g. "days/2026-11-16/logs/physics". */
  write: (path: string, value: unknown) => void;
};

const HubContext = createContext<Hub | null>(null);

function readCache(): HubData | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? normalizeData(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(data: HubData) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    /* storage full or unavailable */
  }
}

/** Firebase rejects undefined anywhere in a value. */
function clean(v: unknown): unknown {
  if (v === undefined) return null;
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = clean(x);
    return out;
  }
  return v;
}

/** Immutable set at a slash path; null removes the key. */
function setIn(root: unknown, parts: string[], value: unknown): unknown {
  // Firebase hands back objects keyed 0, 1, 2… as arrays; treat them as the objects they are.
  const base = Array.isArray(root)
    ? Object.fromEntries(root.map((v, i) => [String(i), v] as const).filter(([, v]) => v !== null && v !== undefined))
    : root && typeof root === "object"
      ? (root as Record<string, unknown>)
      : {};
  const [head, ...rest] = parts;
  const next = { ...base };
  const child = rest.length ? setIn(base[head], rest, value) : value;
  if (child === null || child === undefined) delete next[head];
  else next[head] = child;
  return next;
}

/* ---------- outbox: writes made offline survive the app being closed ---------- */

type OutboxItem = { id: string; path: string; value: unknown };

function readOutbox(): OutboxItem[] {
  try {
    const list = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]") as OutboxItem[];
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

export function HubProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<HubData>(() => normalizeData(null));
  const [loaded, setLoaded] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [today, setToday] = useState("");
  const [now, setNow] = useState(0);
  const [online, setOnline] = useState(false);
  const dataRef = useRef(data);
  const rawRef = useRef<unknown>(null);
  const dbRef = useRef<ReturnType<typeof getDb>>(null);

  const commitRaw = useCallback((raw: unknown) => {
    rawRef.current = raw;
    const next = normalizeData(raw);
    dataRef.current = next;
    setData(next);
    writeCache(next);
  }, []);

  const flushing = useRef(false);
  const flush = useCallback(async () => {
    const db = dbRef.current;
    if (!db || flushing.current) return;
    flushing.current = true;
    try {
      let items = readOutbox();
      while (items.length) {
        const item = items[0];
        try {
          await set(ref(db, `${HUB_PATH}/${item.path}`), item.value);
        } catch {
          break; // offline or refused: try again on the next connection
        }
        items = readOutbox().filter((i) => i.id !== item.id);
        writeOutbox(items);
      }
    } finally {
      flushing.current = false;
    }
  }, []);

  const write = useCallback(
    (path: string, value: unknown) => {
      const v = clean(value);
      commitRaw(setIn(rawRef.current ?? dataRef.current, path.split("/").filter(Boolean), v));
      if (!dbRef.current) return;
      writeOutbox([...readOutbox(), { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, path, value: v }]);
      void flush();
    },
    [commitRaw, flush],
  );

  // The date, and a clock that ticks fast only while a timer is running.
  const timing = Boolean(data.timer);
  useEffect(() => {
    const tick = () => {
      setToday(todayKey());
      setNow(Date.now());
    };
    tick();
    const id = window.setInterval(tick, timing ? 1000 : 30_000);
    const onVis = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [timing]);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    const start = window.setTimeout(() => {
      const cached = readCache();
      if (cached) {
        rawRef.current = cached;
        dataRef.current = cached;
        setData(cached);
      }
      setLoaded(true);

      const db = getDb();
      if (!db) {
        setFresh(true);
        return;
      }
      dbRef.current = db;
      unsubs.push(
        onValue(
          ref(db, HUB_PATH),
          (snap) => {
            // Writes still waiting in the outbox stay on top of what the cloud says.
            let raw: unknown = snap.val() ?? {};
            for (const item of readOutbox()) raw = setIn(raw, item.path.split("/").filter(Boolean), item.value);
            commitRaw(raw);
            setFresh(true);
          },
          () => setOnline(false),
        ),
      );
      unsubs.push(
        onValue(ref(db, ".info/connected"), (snap) => {
          const on = snap.val() === true;
          setOnline(on);
          if (on) void flush();
        }),
      );
    }, 0);
    return () => {
      window.clearTimeout(start);
      unsubs.forEach((u) => u());
    };
  }, [commitRaw, flush]);

  return <HubContext.Provider value={{ data, loaded, fresh, today, now, online, write }}>{children}</HubContext.Provider>;
}

export function useHub(): Hub {
  const s = useContext(HubContext);
  if (!s) throw new Error("useHub outside HubProvider");
  return s;
}
