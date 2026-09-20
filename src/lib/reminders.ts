/**
 * Three ways to get reminded, because an iPhone without Safari can't receive web push:
 *  1. ntfy  – real phone push through the free "ntfy" app. Opt-in. Today's reminders are scheduled with
 *             ntfy's delayed delivery whenever the app is opened, so nothing has to be running later.
 *  2. browser – Notification API while the app is open (laptop / Android).
 *  3. calendar – an .ics file of daily repeating alarms for the phone's own Calendar app.
 */
import { get, ref, set } from "firebase/database";
import type { DayRecord, Settings } from "./types";
import { DATA_PATH, getDb } from "./firebase";

export type ReminderItem = { key: string; time: string; title: string; body: string };

/** What should fire today: each timed habit, plus the evening "submit your day" nudge. */
export function remindersFor(settings: Settings): ReminderItem[] {
  const items: ReminderItem[] = settings.habits
    .filter((h) => h.time)
    .map((h) => ({ key: `${h.id}@${h.time}`, time: h.time as string, title: `${h.emoji ?? "⏰"} ${h.name}`, body: "Time for this one. Tick it when it's done." }));
  items.push({ key: `submit@${settings.reminders.submitTime}`, time: settings.reminders.submitTime, title: "🔒 Submit your day", body: "Tick what you did, rate it, write a line, then lock it in." });
  return items;
}

function atToday(time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

/* ---------- 1. ntfy ---------- */

export function randomTopic(): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "lockedin-";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

async function publish(topic: string, title: string, message: string, at?: Date): Promise<boolean> {
  try {
    const body: Record<string, unknown> = { topic, title, message, tags: ["sunrise"] };
    if (at) body.delay = String(Math.floor(at.getTime() / 1000));
    const res = await fetch("https://ntfy.sh/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.ok;
  } catch {
    return false;
  }
}

export function sendTestPush(topic: string): Promise<boolean> {
  return publish(topic, "Locked In", "Notifications are working. Outside first, phone last.");
}

/**
 * Schedule whatever is left of today's reminders. A small record in the database (and localStorage as a
 * fallback) remembers what has been scheduled, so opening the app on a second device doesn't double up.
 */
export async function scheduleTodayPushes(settings: Settings, today: string, day: DayRecord): Promise<number> {
  const { ntfy, ntfyTopic } = settings.reminders;
  if (!ntfy || !ntfyTopic) return 0;
  const lsKey = `locked-in:ntfy:${today}`;
  let done: string[] = [];
  try {
    done = JSON.parse(localStorage.getItem(lsKey) || "[]");
  } catch {
    /* ignore */
  }
  const db = getDb();
  const node = db ? ref(db, `${DATA_PATH}/pushes/${today}`) : null;
  if (node) {
    try {
      const snap = await get(node);
      const remote = snap.val();
      if (Array.isArray(remote)) done = [...new Set([...done, ...remote.filter((x) => typeof x === "string")])];
    } catch {
      /* offline: fall back to local record */
    }
  }
  const soon = Date.now() + 90_000;
  const doneHabits = new Set(day.habits.filter((h) => h.done).map((h) => h.id));
  const due = remindersFor(settings).filter((r) => {
    if (done.includes(r.key)) return false;
    if (atToday(r.time).getTime() < soon) return false;
    const id = r.key.split("@")[0];
    if (id === "submit") return !day.submitted;
    return !doneHabits.has(id);
  });
  if (!due.length) return 0;
  // Record first, then send: a crash can lose a reminder but never spams duplicates.
  const next = [...done, ...due.map((r) => r.key)];
  try {
    localStorage.setItem(lsKey, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  if (node) await set(node, next).catch(() => undefined);
  let sent = 0;
  for (const r of due) if (await publish(ntfyTopic, r.title, r.body, atToday(r.time))) sent++;
  return sent;
}

/* ---------- 2. browser notifications (while the app is open) ---------- */

export function browserNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function askBrowserPermission(): Promise<boolean> {
  if (!browserNotificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

/** Called every ~30 s while the app is open. Fires anything whose minute has arrived and hasn't fired today. */
export function fireDueBrowserReminders(settings: Settings, today: string, day: DayRecord, now = new Date()): void {
  if (!settings.reminders.browser || !browserNotificationsSupported() || Notification.permission !== "granted") return;
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const lsKey = `locked-in:fired:${today}`;
  let fired: string[] = [];
  try {
    fired = JSON.parse(localStorage.getItem(lsKey) || "[]");
  } catch {
    /* ignore */
  }
  const doneHabits = new Set(day.habits.filter((h) => h.done).map((h) => h.id));
  for (const r of remindersFor(settings)) {
    if (r.time !== hhmm || fired.includes(r.key)) continue;
    const id = r.key.split("@")[0];
    if (id === "submit" ? Boolean(day.submitted) : doneHabits.has(id)) continue;
    fired.push(r.key);
    try {
      new Notification(r.title, { body: r.body, icon: "/icons/icon-192.png", tag: r.key });
    } catch {
      /* some browsers only allow notifications from a service worker */
      navigator.serviceWorker?.getRegistration().then((reg) => reg?.showNotification(r.title, { body: r.body, icon: "/icons/icon-192.png", tag: r.key }));
    }
  }
  try {
    localStorage.setItem(lsKey, JSON.stringify(fired));
  } catch {
    /* ignore */
  }
}

/* ---------- 3. calendar file ---------- */

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Daily repeating events with an alarm at the start, in floating local time. */
export function buildIcs(settings: Settings, startDate: string): string {
  const ymd = startDate.replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Locked In//Reminders//EN", "CALSCALE:GREGORIAN"];
  for (const r of remindersFor(settings)) {
    const hhmm = r.time.replace(":", "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${r.key.replace(/[^A-Za-z0-9]/g, "")}-${ymd}@locked-in`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${ymd}T${hhmm}00`,
      "DURATION:PT10M",
      "RRULE:FREQ=DAILY",
      `SUMMARY:${icsEscape(r.title)}`,
      `DESCRIPTION:${icsEscape(r.body)}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape(r.title)}`,
      "TRIGGER:PT0M",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
