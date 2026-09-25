"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { get, goOffline, goOnline, onValue, ref, remove, set, update } from "firebase/database";
import type { AppData, DayRecord, JournalCrypto, Settings } from "./types";
import { hasJournal, legacyJournalText, materializeDay, normalizeData, normalizeDays, normalizeJournalCrypto, normalizeSettings, normalizeStudy, sortHabits, stripUndefined } from "./model";
import { addDays, todayKey } from "./dates";
import { DATA_PATH, getDb } from "./firebase";
import { decryptText, deriveKey, encryptText, forgetKey, makeCryptoParams, newSalt, recallKey, rememberKey, verifyKey } from "./crypto";

export type SyncState = "local" | "connecting" | "online" | "offline";
export type JournalState = "unavailable" | "none" | "locked" | "unlocked";

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
  /** Encrypted personal journal. */
  journalState: JournalState;
  journalBusy: boolean;
  journalText: (date: string) => string | null; // decrypted text for this session, or null if none / locked
  setupJournal: (passphrase: string) => Promise<number>; // creates the key, encrypts legacy entries; returns how many were migrated
  unlockJournal: (passphrase: string) => Promise<boolean>;
  lockJournal: () => Promise<void>;
  changePassphrase: (current: string, next: string) => Promise<number>; // returns how many entries were re-encrypted
  saveJournal: (date: string, text: string) => Promise<void>;
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

  // Journal key lives only in memory (and, non-extractable, in IndexedDB). Decrypted text only in memory.
  const keyRef = useRef<CryptoKey | null>(null);
  const [journalState, setJournalState] = useState<JournalState>("none");
  const [journalBusy, setJournalBusy] = useState(false);
  const [plain, setPlain] = useState<Record<string, string>>({});
  const plainRef = useRef(plain);
  plainRef.current = plain;

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
      if (!db) return;
      dbRef.current = db;
      setSync("connecting");

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

  // Work out the journal state whenever the crypto params change: try the remembered device key.
  const cryptoSalt = data.journalCrypto?.salt ?? null;
  const cryptoVerifierCt = data.journalCrypto?.verifier.ct ?? null;
  useEffect(() => {
    let cancelled = false;
    const params = dataRef.current.journalCrypto;
    if (typeof crypto === "undefined" || !crypto.subtle) {
      window.setTimeout(() => !cancelled && setJournalState("unavailable"), 0);
      return;
    }
    if (!params) {
      keyRef.current = null;
      window.setTimeout(() => !cancelled && setJournalState("none"), 0);
      return;
    }
    if (keyRef.current) {
      verifyKey(keyRef.current, params).then((ok) => {
        if (cancelled) return;
        if (!ok) {
          keyRef.current = null;
          setPlain({});
          setJournalState("locked");
        }
      });
      return;
    }
    recallKey().then(async (remembered) => {
      if (cancelled) return;
      if (remembered && remembered.salt === params.salt && (await verifyKey(remembered.key, params))) {
        keyRef.current = remembered.key;
        if (!cancelled) setJournalState("unlocked");
      } else {
        if (remembered) await forgetKey();
        if (!cancelled) setJournalState("locked");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [cryptoSalt, cryptoVerifierCt, loaded]);

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

  /* ---- encrypted journal ---- */

  const journalText = useCallback((date: string): string | null => (date in plain ? plain[date] : null), [plain]);

  // Decrypt on demand whenever the key is present and a day has ciphertext we haven't read yet.
  useEffect(() => {
    const key = keyRef.current;
    if (!key || journalState !== "unlocked") return;
    let cancelled = false;
    const todo = Object.values(data.days).filter((d) => d.journalEnc && !(d.date in plainRef.current));
    if (!todo.length) return;
    (async () => {
      const found: Record<string, string> = {};
      for (const d of todo) {
        try {
          found[d.date] = await decryptText(key, d.journalEnc!);
        } catch {
          /* written under a different key: leave it out */
        }
      }
      if (!cancelled && Object.keys(found).length) setPlain((p) => ({ ...p, ...found }));
    })();
    return () => {
      cancelled = true;
    };
  }, [data.days, journalState]);

  /** Apply a set of day changes + crypto params locally, then send them as one atomic multi-path update. */
  const applyJournalBatch = useCallback(
    (params: JournalCrypto, days: Record<string, DayRecord>) => {
      const prev = dataRef.current;
      const nextDays = { ...prev.days, ...days };
      commit({ ...prev, days: nextDays, journalCrypto: params });
      const paths: Record<string, unknown> = { journalCrypto: params };
      for (const [date, day] of Object.entries(days)) paths[`days/${date}`] = day;
      remote("update", DATA_PATH, paths);
    },
    [commit, remote],
  );

  const setupJournal = useCallback(
    async (passphrase: string): Promise<number> => {
      setJournalBusy(true);
      try {
        const salt = newSalt();
        const key = await deriveKey(passphrase, salt);
        const params = await makeCryptoParams(key, salt);
        const changed: Record<string, DayRecord> = {};
        const texts: Record<string, string> = {};
        for (const day of Object.values(dataRef.current.days)) {
          if (!day.journal?.trim() && !day.recall?.trim()) continue;
          const text = legacyJournalText(day);
          const enc = await encryptText(key, text);
          if ((await decryptText(key, enc)) !== text) throw new Error("Encryption round-trip failed; nothing was changed.");
          const next: DayRecord = stripUndefined({ ...day, journalEnc: enc, journal: undefined, recall: undefined, updatedAt: Date.now() });
          changed[day.date] = next;
          texts[day.date] = text;
        }
        applyJournalBatch(params, changed);
        keyRef.current = key;
        await rememberKey(key, salt);
        setPlain((p) => ({ ...p, ...texts }));
        setJournalState("unlocked");
        return Object.keys(changed).length;
      } finally {
        setJournalBusy(false);
      }
    },
    [applyJournalBatch],
  );

  const unlockJournal = useCallback(async (passphrase: string): Promise<boolean> => {
    const params = dataRef.current.journalCrypto;
    if (!params) return false;
    setJournalBusy(true);
    try {
      const key = await deriveKey(passphrase, params.salt, params.iterations);
      if (!(await verifyKey(key, params))) return false;
      keyRef.current = key;
      await rememberKey(key, params.salt);
      setJournalState("unlocked");
      return true;
    } finally {
      setJournalBusy(false);
    }
  }, []);

  const lockJournal = useCallback(async () => {
    keyRef.current = null;
    setPlain({});
    await forgetKey();
    setJournalState(dataRef.current.journalCrypto ? "locked" : "none");
  }, []);

  const changePassphrase = useCallback(
    async (current: string, next: string): Promise<number> => {
      const params = dataRef.current.journalCrypto;
      if (!params) throw new Error("No passphrase set yet.");
      setJournalBusy(true);
      try {
        const oldKey = await deriveKey(current, params.salt, params.iterations);
        if (!(await verifyKey(oldKey, params))) throw new Error("Current passphrase is wrong.");
        const salt = newSalt();
        const newKey = await deriveKey(next, salt);
        const newParams = await makeCryptoParams(newKey, salt);
        const changed: Record<string, DayRecord> = {};
        const texts: Record<string, string> = {};
        for (const day of Object.values(dataRef.current.days)) {
          if (!day.journalEnc) continue;
          const text = await decryptText(oldKey, day.journalEnc);
          const enc = await encryptText(newKey, text);
          if ((await decryptText(newKey, enc)) !== text) throw new Error("Re-encryption check failed; nothing was changed.");
          changed[day.date] = stripUndefined({ ...day, journalEnc: enc, updatedAt: Date.now() });
          texts[day.date] = text;
        }
        applyJournalBatch(newParams, changed);
        keyRef.current = newKey;
        await rememberKey(newKey, salt);
        setPlain(texts);
        setJournalState("unlocked");
        return Object.keys(changed).length;
      } finally {
        setJournalBusy(false);
      }
    },
    [applyJournalBatch],
  );

  const saveJournal = useCallback(
    async (date: string, text: string) => {
      const key = keyRef.current;
      if (!key) throw new Error("Journal is locked.");
      setPlain((p) => ({ ...p, [date]: text }));
      if (!text.trim()) {
        updateDay(date, (d) => ({ ...d, journalEnc: undefined, journal: undefined, recall: undefined }));
        return;
      }
      const enc = await encryptText(key, text);
      updateDay(date, (d) => ({ ...d, journalEnc: enc, journal: undefined, recall: undefined }));
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
      hasJournalPlaintext: () => Object.values(dataRef.current.days).some((d) => hasJournal(d) && !d.journalEnc),
    };
  }, []);

  const value = useMemo<Store>(
    () => ({
      data, loaded, today, sync, pending, getDay, updateDay, updateSettings, carryTodoOver, getDayPhoto, setDayPhoto, removeDayPhoto,
      journalState, journalBusy, journalText, setupJournal, unlockJournal, lockJournal, changePassphrase, saveJournal,
    }),
    [data, loaded, today, sync, pending, getDay, updateDay, updateSettings, carryTodoOver, getDayPhoto, setDayPhoto, removeDayPhoto, journalState, journalBusy, journalText, setupJournal, unlockJournal, lockJournal, changePassphrase, saveJournal],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside AppProviders");
  return ctx;
}
