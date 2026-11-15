"use client";

import { useCallback } from "react";
import { useHub } from "./store";
import type { SubjectId } from "./types";
import { uid } from "./model";
import { haptic, playStart, playStop } from "./chimes";

/** The study timer. It lives in the database, so it keeps running if you close the app or switch device. */
export function useTimer() {
  const { data, write } = useHub();
  const timer = data.timer;

  const stop = useCallback(() => {
    if (!timer) return;
    const end = Date.now();
    // Under a minute doesn't count.
    if (end - timer.start >= 60_000) write(`sessions/${uid()}`, { subject: timer.subject, start: timer.start, end });
    write("timer", null);
    playStop();
    haptic(8);
  }, [timer, write]);

  const start = useCallback(
    (subject: SubjectId) => {
      if (timer) {
        if (timer.subject === subject) return;
        // Switching subject: close the running block and start the next straight away.
        const end = Date.now();
        if (end - timer.start >= 60_000) write(`sessions/${uid()}`, { subject: timer.subject, start: timer.start, end });
      }
      write("timer", { subject, start: Date.now() });
      playStart();
      haptic(10);
    },
    [timer, write],
  );

  return { timer, start, stop };
}
