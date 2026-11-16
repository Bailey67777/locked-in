"use client";

import { useEffect } from "react";
import { DATA_KEY } from "../firebase";
import { normalizeWhoop } from "./model";
import { useHub } from "./store";

/** The app's side of the WHOOP connection: ask the server (which holds the keys) and show what comes back. */

export type WhoopReply = { url?: string; days?: Record<string, unknown>; ok?: boolean; error?: string; code?: "setup" | "keys" | "connect" | "down" };

export async function whoopCall(action: "start" | "keys" | "sync" | "disconnect", extra: Record<string, string> = {}): Promise<WhoopReply> {
  const res = await fetch("/api/whoop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: DATA_KEY, action, ...extra }) });
  return (await res.json().catch(() => ({}))) as WhoopReply;
}

/** How long numbers are trusted before asking again. A recovery only changes once a day; strain creeps up. */
const FRESH_MS = 20 * 60_000;
let asked = 0;

/** Keep the WHOOP numbers current while the app is open: when it opens, and each time it's come back to. */
export function useWhoopSync() {
  const { data, fresh, online, adopt } = useHub();
  const on = data.settings.whoop;
  useEffect(() => {
    if (!on || !fresh || !online) return;
    const run = () => {
      if (document.visibilityState !== "visible" || Date.now() - asked < FRESH_MS) return;
      asked = Date.now();
      whoopCall("sync")
        .then((r) => {
          for (const [date, v] of Object.entries(r.days ?? {})) {
            const day = normalizeWhoop(v);
            if (day) adopt(`whoop/${date}`, day);
          }
        })
        .catch(() => {
          asked = 0; // offline or the server was down: try again next time
        });
    };
    run();
    document.addEventListener("visibilitychange", run);
    return () => document.removeEventListener("visibilitychange", run);
  }, [on, fresh, online, adopt]);
}

/** Minutes asleep as "7h 12m". */
export const sleepLength = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
