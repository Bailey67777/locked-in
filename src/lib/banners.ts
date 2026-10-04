"use client";

import { useCallback, useEffect, useState } from "react";
import { onValue, ref, remove, set } from "firebase/database";
import { DATA_PATH, getDb } from "./firebase";
import { uid } from "./model";
import type { Season } from "./season";

/** A banner photo uploaded from inside the app, stored at banners/<season>/<id> (both devices see it). */
export type Banner = { id: string; data: string; at: number };

const KEY = (s: Season) => `locked-in:banners:${s}`;

function readLocal(s: Season): Banner[] | null {
  try {
    const raw = localStorage.getItem(KEY(s));
    return raw ? (JSON.parse(raw) as Banner[]) : null;
  } catch {
    return null;
  }
}

function writeLocal(s: Season, list: Banner[]) {
  try {
    localStorage.setItem(KEY(s), JSON.stringify(list));
  } catch {
    /* storage full: the banner just loads from the cloud next time */
  }
}

function normalize(raw: unknown): Banner[] {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, { data?: unknown; at?: unknown }>;
  return Object.entries(obj)
    .filter(([, v]) => typeof v?.data === "string" && v.data.startsWith("data:image/"))
    .map(([id, v]) => ({ id, data: v.data as string, at: typeof v.at === "number" ? v.at : 0 }))
    .sort((a, b) => a.at - b.at);
}

type State = { season: Season; list: Banner[]; ready: boolean };

/** This season's uploaded banner photos, oldest first, with add/remove. */
export function useBanners(season: Season) {
  const [state, setState] = useState<State>({ season, list: [], ready: false });

  useEffect(() => {
    const db = getDb();
    let cancelled = false;
    // The cached copy shows straight away; the cloud copy replaces it as soon as it arrives.
    const t = window.setTimeout(() => {
      const cached = readLocal(season);
      if (!cancelled) setState((s) => (s.season === season && s.ready ? s : { season, list: cached ?? [], ready: cached !== null || !db }));
    }, 0);
    if (!db) {
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }
    const unsub = onValue(
      ref(db, `${DATA_PATH}/banners/${season}`),
      (snap) => {
        const list = normalize(snap.val());
        writeLocal(season, list);
        if (!cancelled) setState({ season, list, ready: true });
      },
      () => !cancelled && setState((s) => ({ ...s, season, ready: true })),
    );
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      unsub();
    };
  }, [season]);

  const add = useCallback(
    (data: string) => {
      const b: Banner = { id: uid(), data, at: Date.now() };
      setState((s) => {
        const list = [...(s.season === season ? s.list : []), b];
        writeLocal(season, list);
        return { season, list, ready: true };
      });
      const db = getDb();
      if (db) set(ref(db, `${DATA_PATH}/banners/${season}/${b.id}`), { data, at: b.at }).catch(() => undefined);
    },
    [season],
  );

  const removeBanner = useCallback(
    (id: string) => {
      setState((s) => {
        const list = (s.season === season ? s.list : []).filter((b) => b.id !== id);
        writeLocal(season, list);
        return { season, list, ready: true };
      });
      const db = getDb();
      if (db) remove(ref(db, `${DATA_PATH}/banners/${season}/${id}`)).catch(() => undefined);
    },
    [season],
  );

  const current = state.season === season ? state : { season, list: [], ready: false };
  return { list: current.list, ready: current.ready, add, remove: removeBanner };
}

const PROFILE_KEY = "locked-in:profile";

/** The profile picture uploaded from Settings (stored at profile/), or null to use public/photos/profile.jpg. */
export function useProfilePhoto() {
  const [photo, setPhoto] = useState<{ data: string | null; ready: boolean }>({ data: null, ready: false });

  useEffect(() => {
    const db = getDb();
    let cancelled = false;
    const t = window.setTimeout(() => {
      let cached: string | null = null;
      try {
        cached = localStorage.getItem(PROFILE_KEY);
      } catch {
        /* ignore */
      }
      if (!cancelled) setPhoto((p) => (p.ready ? p : { data: cached, ready: cached !== null || !db }));
    }, 0);
    if (!db) {
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }
    const unsub = onValue(
      ref(db, `${DATA_PATH}/profile`),
      (snap) => {
        const v = snap.val() as { data?: unknown } | null;
        const data = typeof v?.data === "string" && v.data.startsWith("data:image/") ? v.data : null;
        try {
          if (data) localStorage.setItem(PROFILE_KEY, data);
          else localStorage.removeItem(PROFILE_KEY);
        } catch {
          /* ignore */
        }
        if (!cancelled) setPhoto({ data, ready: true });
      },
      () => !cancelled && setPhoto((p) => ({ ...p, ready: true })),
    );
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      unsub();
    };
  }, []);

  const save = useCallback((data: string | null) => {
    setPhoto({ data, ready: true });
    try {
      if (data) localStorage.setItem(PROFILE_KEY, data);
      else localStorage.removeItem(PROFILE_KEY);
    } catch {
      /* ignore */
    }
    const db = getDb();
    if (!db) return;
    if (data) set(ref(db, `${DATA_PATH}/profile`), { data, at: Date.now() }).catch(() => undefined);
    else remove(ref(db, `${DATA_PATH}/profile`)).catch(() => undefined);
  }, []);

  return { ...photo, save };
}
