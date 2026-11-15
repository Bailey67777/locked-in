"use client";

import { useEffect, useState } from "react";
import type { CalendarEvent } from "./model";
import { dayBounds } from "./time";
import { DATA_KEY } from "../firebase";

/** Lessons from the linked calendar for one day, cached on the device so it opens instantly and offline. */

const CACHE_KEY = "locked-in:calendar:v1";
const FRESH_MS = 10 * 60_000;
type Entry = { at: number; events: CalendarEvent[] };
const memory = new Map<string, Entry>();

function readStore(): Record<string, Entry> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, Entry>;
  } catch {
    return {};
  }
}

function remember(key: string, entry: Entry) {
  memory.set(key, entry);
  try {
    const all = readStore();
    all[key] = entry;
    // Keep the 60 most recent days.
    const keys = Object.keys(all).sort((a, b) => all[b].at - all[a].at);
    for (const k of keys.slice(60)) delete all[k];
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export async function fetchEvents(url: string, from: number, to: number): Promise<CalendarEvent[]> {
  const res = await fetch("/api/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, from, to, key: DATA_KEY }) });
  const body = (await res.json().catch(() => ({}))) as { events?: CalendarEvent[]; error?: string };
  if (!res.ok || !body.events) throw new Error(body.error ?? "Couldn't load the calendar.");
  return body.events;
}

export function useCalendarDay(url: string, date: string): { events: CalendarEvent[] | null; error: string | null } {
  const key = `${url}|${date}`;
  const [state, setState] = useState<{ key: string; events: CalendarEvent[] | null; error: string | null }>({ key: "", events: null, error: null });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const cached = memory.get(key) ?? readStore()[key];
    const id = window.setTimeout(() => {
      if (cached) setState({ key, events: cached.events, error: null });
      if (cached && Date.now() - cached.at < FRESH_MS) return;
      const [from, to] = dayBounds(date);
      fetchEvents(url, from, to)
        .then((events) => {
          remember(key, { at: Date.now(), events });
          if (!cancelled) setState({ key, events, error: null });
        })
        .catch((e: unknown) => {
          if (!cancelled) setState((s) => ({ key, events: s.key === key ? s.events : (cached?.events ?? null), error: e instanceof Error ? e.message : "Couldn't load the calendar." }));
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [key, url, date]);

  if (!url || state.key !== key) return { events: null, error: null };
  return { events: state.events, error: state.error };
}
