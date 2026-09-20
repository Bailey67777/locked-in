"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { fireDueBrowserReminders, scheduleTodayPushes } from "@/lib/reminders";

/** Invisible: keeps reminders going while the app is open, and schedules today's phone pushes. */
export default function ReminderRunner() {
  const { loaded, today, data, getDay } = useStore();
  const settings = data.settings;
  const habitSignature = settings.habits.map((h) => `${h.id}@${h.time ?? ""}`).join("|");

  // Phone pushes (ntfy): schedule what's left of today a few seconds after opening / after changes settle.
  useEffect(() => {
    if (!loaded || !today || !settings.reminders.ntfy || !settings.reminders.ntfyTopic) return;
    const id = window.setTimeout(() => void scheduleTodayPushes(settings, today, getDay(today)), 4000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, today, settings.reminders.ntfy, settings.reminders.ntfyTopic, settings.reminders.submitTime, habitSignature]);

  // Browser notifications: check twice a minute while the app is open.
  useEffect(() => {
    if (!loaded || !today || !settings.reminders.browser) return;
    const check = () => fireDueBrowserReminders(settings, today, getDay(today));
    const id = window.setInterval(check, 25_000);
    return () => window.clearInterval(id);
  }, [loaded, today, settings, getDay]);

  return null;
}
