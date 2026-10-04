"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { get, goOffline, goOnline, onValue, ref, remove, set, update } from "firebase/database";
import type { AppData, DayRecord, Settings } from "./types";
import { legacyJournalText, materializeDay, normalizeData, normalizeDays, normalizeJournalCrypto, normalizeSettings, normalizeStudy, sortHabits, stripUndefined } from "./model";
import { addDays, todayKey } from "./dates";
import { DATA_PATH, getDb } from "./firebase";
import { decryptText, deriveKey, forgetKey, recallKey, verifyKey } from "./crypto";
import { type Season, type SeasonChoice, readSeasonChoice, resolveSeason, writeSeasonChoice } from "./season";

export type SyncState = "local" | "connecting" | "online" | "offline";
/** ready: plain journal. locked: older entries still need the old passphrase once. unavailable: they do, but this browser can't decrypt. */
export type JournalState = "ready" | "locked" | "unavailable";

const LS_KEY = "locked-in:data:v1";
const OUTBOX_KEY = "locked-in:outbox:v1";
const PHOTO_KEY = (date: string) => `locked-in:photo:${date}`;

type Store = {
  data: AppData;
  loaded: boolean;
  today: string;
  sync: SyncState;
  pending: number;
  getDay: (date: string) => DayRecord;
  updateDay: (date: string, fn: (day: DayRecord) => DayRecord) => void;
  updateSettings: (fn: (s: Settings) => Settings) => void;
  carryTodoOver: (date: string, todoId: string) => void;
  getDayPhoto: (date: string) => Promise<string | null>;
  setDayPhoto: (date: string, photo: { medium: string; thumb: string }) => Promise<void>;
  removeDayPhoto: (date: string) => Promise<void>;
  /** Personal journal (plain text). */
  journalState: JournalState;
  journalBusy: boolean;
  /** Days whose entries are still locked behind the old passphrase. */
  lockedEntries: number;
  journalText: (date: string) => string;
  saveJournal: (date: string, text: string) => void;
  /** Enter the old passphrase once: every old entry becomes plain text and the passphrase is gone for good. */
  unlockJournal: (passphrase: string) => Promise<boolean>;
  season: Season;
  seasonChoice: SeasonChoice;
  setSeasonChoice: (choice: SeasonChoice) => void;
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
    localStorage.setItem(LS_KEY, JSON.stringify(data)); // holds only ciphertext for the journal, never plaintext
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
  const dataRef = useRef(data);
  const todayRef = useRef(today);
  const dbRef = useRef<ReturnType<typeof getDb>>(null);

  // True once the cloud copy of the days has arrived (or there is no cloud), so the journal migration never acts on a stale cache.
  const [remoteReady, setRemoteReady] = useState(false);
  const [journalBusy, setJournalBusy] = useState(false);
  const [autoTried, setAutoTried] = useState(false);
  const migrating = useRef(false);

  const [seasonChoice, setSeasonChoiceState] = useState<SeasonChoice>("auto");

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
      setSeasonChoiceState(readSeasonChoice());

      const db = getDb();
      if (!db) {
        setRemoteReady(true);
        return;
      }
      dbRef.current = db;
      setSync("connecting");

      let gotDays = false;
      let gotCrypto = false;
      const markReady = () => gotDays && gotCrypto && setRemoteReady(true);

      // Days, settings, study and crypto params are listened to separately so photos (under /photos) never ride along.
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
            gotDays = true;
            markReady();
          },
          () => setSync("offline"),
        ),
      );
      unsubs.push(
        onValue(ref(db, `${DATA_PATH}/settings`), (snap) => {
          if (!snap.exists()) return;
          commit({ ...dataRef.current, settings: normalizeSettings(snap.val()) });
        }),
      );
      unsubs.push(
        onValue(ref(db, `${DATA_PATH}/study`), (snap) => {
          commit({ ...dataRef.current, study: normalizeStudy(snap.val()) });
        }),
      );
      unsubs.push(
        onValue(ref(db, `${DATA_PATH}/journalCrypto`), (snap) => {
          commit({ ...dataRef.current, journalCrypto: normalizeJournalCrypto(snap.val()) });
          gotCrypto = true;
          markReady();
        }),
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

  /* ---- journal: the passphrase is gone; old encrypted entries are converted to plain text once ---- */

  const lockedEntries = useMemo(() => Object.values(data.days).filter((d) => d.journalEnc).length, [data.days]);
  const hasCryptoParams = data.journalCrypto !== null;
  const canDecrypt = typeof crypto !== "undefined" && Boolean(crypto.subtle);
  const journalState: JournalState = lockedEntries === 0 ? "ready" : !hasCryptoParams ? "ready" : canDecrypt ? "locked" : "unavailable";

  /** Decrypt every old entry with `key`, store it as plain text, and drop the passphrase data (one atomic write). */
  const migrateJournal = useCallback(
    async (key: CryptoKey | null) => {
      if (migrating.current) return;
      migrating.current = true;
      try {
        const prev = dataRef.current;
        const changed: Record<string, DayRecord> = {};
        let failed = 0;
        for (const day of Object.values(prev.days)) {
          if (!day.journalEnc) continue;
          let text: string;
          try {
            if (!key) throw new Error("no key");
            text = await decryptText(key, day.journalEnc);
          } catch {
            failed++;
            continue;
          }
          const existing = legacyJournalText(day);
          const merged = text.trim() && existing ? `${text}\n\n${existing}` : text.trim() || existing;
          changed[day.date] = stripUndefined({ ...day, journal: merged || undefined, recall: undefined, journalEnc: undefined, updatedAt: Date.now() });
        }
        const paths: Record<string, unknown> = {};
        for (const [date, day] of Object.entries(changed)) paths[`days/${date}`] = day;
        const done = failed === 0;
        if (done) paths.journalCrypto = null;
        if (!Object.keys(paths).length) return;
        commit({ ...prev, days: { ...prev.days, ...changed }, journalCrypto: done ? null : prev.journalCrypto });
        remote("update", DATA_PATH, paths);
        if (done) await forgetKey();
      } finally {
        migrating.current = false;
      }
    },
    [commit, remote],
  );

  // On each device: once the cloud copy is in, convert with the key this device remembers (if any),
  // or just drop leftover passphrase data when no encrypted entries remain.
  useEffect(() => {
    if (!remoteReady || autoTried || !hasCryptoParams) return;
    let cancelled = false;
    (async () => {
      if (lockedEntries === 0) {
        await migrateJournal(null);
      } else if (canDecrypt) {
        const params = dataRef.current.journalCrypto;
        const remembered = await recallKey().catch(() => null);
        if (!cancelled && params && remembered && remembered.salt === params.salt && (await verifyKey(remembered.key, params))) await migrateJournal(remembered.key);
      }
      if (!cancelled) setAutoTried(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [remoteReady, autoTried, hasCryptoParams, lockedEntries, canDecrypt, migrateJournal]);

  const pushDay = useCallback((date: string, day: DayRecord) => remote("set", `${DATA_PATH}/days/${date}`, day), [remote]);

  const getDay = useCallback(
    (date: string) => materializeDay(date, data.days[date], data.settings, today || date),
    [data, today],
  );

  const updateDay = useCallback(
    (date: string, fn: (day: DayRecord) => DayRecord) => {
      const prev = dataRef.current;
      const current = materializeDay(date, prev.days[date], prev.settings, todayRef.current || date);
      const nextDay: DayRecord = stripUndefined({ ...fn(current), date, updatedAt: Date.now() }); // Firebase rejects undefined values
      commit({ ...prev, days: { ...prev.days, [date]: nextDay } });
      pushDay(date, nextDay);
    },
    [commit, pushDay],
  );

  const updateSettings = useCallback(
    (fn: (s: Settings) => Settings) => {
      const prev = dataRef.current;
      const next = fn(prev.settings);
      const settings: Settings = stripUndefined({ ...next, habits: sortHabits(next.habits) });
      commit({ ...prev, settings });
      remote("set", `${DATA_PATH}/settings`, settings);
    },
    [commit, remote],
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

  /* ---- photos ---- */

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
      remote("set", `${DATA_PATH}/photos/${date}`, { data: photo.medium, updatedAt: Date.now() });
    },
    [updateDay, remote],
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
      remote("remove", `${DATA_PATH}/photos/${date}`);
    },
    [updateDay, remote],
  );

  /* ---- journal ---- */

  const journalText = useCallback((date: string): string => {
    const d = data.days[date];
    return d ? legacyJournalText(d) : "";
  }, [data.days]);

  const saveJournal = useCallback(
    (date: string, text: string) => updateDay(date, (d) => ({ ...d, journal: text.trim() ? text : undefined, recall: undefined })),
    [updateDay],
  );

  const unlockJournal = useCallback(
    async (passphrase: string): Promise<boolean> => {
      const params = dataRef.current.journalCrypto;
      if (!params) return false;
      setJournalBusy(true);
      try {
        const key = await deriveKey(passphrase, params.salt, params.iterations);
        if (!(await verifyKey(key, params))) return false;
        await migrateJournal(key);
        return true;
      } finally {
        setJournalBusy(false);
      }
    },
    [migrateJournal],
  );

  /* ---- season ---- */

  const season = useMemo(() => resolveSeason(seasonChoice, today ? new Date(`${today}T12:00`) : new Date()), [seasonChoice, today]);
  useEffect(() => {
    document.documentElement.setAttribute("data-season", season);
  }, [season]);
  const setSeasonChoice = useCallback((choice: SeasonChoice) => {
    writeSeasonChoice(choice);
    setSeasonChoiceState(choice);
  }, []);

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
    () => ({
      data, loaded, today, sync, pending, getDay, updateDay, updateSettings, carryTodoOver, getDayPhoto, setDayPhoto, removeDayPhoto,
      journalState, journalBusy, lockedEntries, journalText, saveJournal, unlockJournal, season, seasonChoice, setSeasonChoice,
    }),
    [data, loaded, today, sync, pending, getDay, updateDay, updateSettings, carryTodoOver, getDayPhoto, setDayPhoto, removeDayPhoto, journalState, journalBusy, lockedEntries, journalText, saveJournal, unlockJournal, season, seasonChoice, setSeasonChoice],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside AppProviders");
  return ctx;
}
