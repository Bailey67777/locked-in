"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useHub } from "@/lib/hub/store";
import { useVault } from "@/lib/hub/useVault";
import { fetchEvents } from "@/lib/hub/calendar";
import { dayBounds } from "@/lib/hub/time";
import { SUBJECT_META, subjectFromTitle } from "@/lib/hub/subjects";
import { addDays } from "@/lib/dates";
import { DATA_KEY } from "@/lib/firebase";
import { soundName } from "@/lib/sounds";
import { useEditBank } from "@/lib/edits";
import { applyTheme, readTheme, type ThemeChoice } from "@/lib/theme";
import { cloudConfigured } from "@/lib/firebase";
import { cn } from "@/lib/cn";
import { ChevronIcon } from "./Icons";
import HabitSheet from "./HabitSheet";
import TimetableSheet from "./TimetableSheet";
import ExamsSheet from "./ExamsSheet";
import PasscodeSheet from "./PasscodeSheet";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STARE_LENGTHS = [5, 10, 15, 20];

function Section({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="mt-9 first:mt-0">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="label">{title}</div>
        {aside && <div className="font-mono text-[11px] tabular-nums text-muted">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className={cn("relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-200", on ? "bg-ink" : "bg-track")}>
      <span className={cn("absolute top-[3px] h-6 w-6 rounded-full bg-bg shadow-sm transition-all duration-200", on ? "left-[23px]" : "left-[3px]")} />
    </button>
  );
}

export default function SettingsView() {
  const { data, updateSettings, sync, pending } = useStore();
  const bank = useEditBank();
  const settings = data.settings;
  const habits = settings.habits;
  const [editing, setEditing] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeChoice>(() => (typeof window === "undefined" ? "system" : readTheme()));
  const hub = useHub();
  const vault = useVault();
  const school = hub.data.settings;
  const [day, setDay] = useState<number | null>(null);
  const [exams, setExams] = useState(false);
  const [passcode, setPasscode] = useState<"create" | "unlock" | "change" | null>(null);
  const [cal, setCal] = useState(school.calendarUrl);
  const [calStatus, setCalStatus] = useState<string | null>(null);
  const [claude, setClaude] = useState<string | null>(null);
  const [claudeLink, setClaudeLink] = useState<string | null>(null);
  const examCount = Object.values(school.exams).filter((e) => e.date >= hub.today).length;

  const saveCalendar = async () => {
    const url = cal.trim();
    if (url === school.calendarUrl && calStatus) return;
    hub.write("settings/calendarUrl", url || null);
    if (!url) return setCalStatus(null);
    setCalStatus("Checking…");
    try {
      const [from] = dayBounds(hub.today);
      const events = await fetchEvents(url, from, dayBounds(addDays(hub.today, 13))[1]);
      const lessons = events.filter((e) => subjectFromTitle(e.title)).length;
      setCalStatus(`${lessons} lesson${lessons === 1 ? "" : "s"} in the next two weeks`);
    } catch (e) {
      setCalStatus(e instanceof Error ? e.message : "Couldn't load it.");
    }
  };

  /**
   * The link that connects Claude to the app. The server only hands it to this app, never puts it in the page.
   * iPhones only allow copying straight from a tap, so the clipboard is given a promise of the link, not the link.
   */
  const copyClaudeLink = async () => {
    setClaude("…");
    setClaudeLink(null);
    const link = fetch("/api/mcp-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: DATA_KEY }) }).then(async (res) => {
      const body = (await res.json().catch(() => ({}))) as { url?: string };
      if (!res.ok || !body.url) throw new Error("no link");
      return body.url;
    });
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": link.then((u) => new Blob([u], { type: "text/plain" })) })]);
      } else {
        await navigator.clipboard.writeText(await link);
      }
      setClaude("Copied");
    } catch {
      // Copying was refused: show the link so it can be copied by hand.
      const url = await link.catch(() => null);
      setClaudeLink(url);
      setClaude(url ? null : "Couldn't get it");
    }
    window.setTimeout(() => setClaude(null), 2500);
  };

  const move = (i: number, dir: -1 | 1) =>
    updateSettings((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.habits.length) return s;
      const next = [...s.habits];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...s, habits: next };
    });

  const syncLine =
    !cloudConfigured || sync === "local"
      ? "Saved on this device only"
      : sync === "online"
        ? pending
          ? `Syncing ${pending} change${pending === 1 ? "" : "s"}…`
          : "Synced across your devices"
        : sync === "offline"
          ? "Offline. Changes sync when you're back."
          : "Connecting…";

  return (
    <div className="fade-up">
      <header className="mb-7">
        <h1 className="text-[36px] font-bold leading-none tracking-[-0.04em]">Settings</h1>
      </header>

      <Section title="Habits">
        <ul className="divide-y divide-line border-y border-line">
          {habits.map((h, i) => {
            const edit = h.editId ? bank.byId[h.editId] : undefined;
            return (
              <li key={h.id} className="flex items-center gap-1">
                <button type="button" onClick={() => setEditing(h.id)} className="tap flex min-w-0 flex-1 items-center gap-3 py-3.5 text-left">
                  <span className="min-w-0 flex-1 truncate text-[17px] font-medium tracking-[-0.01em]">{h.name}</span>
                  <span className="shrink-0 text-[12.5px] text-muted">
                    {soundName(h.sound)}
                    {edit ? " · edit" : ""}
                  </span>
                </button>
                <span className="flex shrink-0 flex-col">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="flex h-5 w-7 items-center justify-center text-muted disabled:opacity-20" aria-label={`Move ${h.name} up`}>
                    <ChevronIcon dir="up" width={14} height={14} />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === habits.length - 1} className="flex h-5 w-7 items-center justify-center text-muted disabled:opacity-20" aria-label={`Move ${h.name} down`}>
                    <ChevronIcon dir="down" width={14} height={14} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Lessons">
        <ul className="divide-y divide-line border-y border-line">
          {DAY_ORDER.map((d) => {
            const lessons = school.timetable[String(d)] ?? [];
            return (
              <li key={d}>
                <button type="button" onClick={() => setDay(d)} className="tap flex w-full items-center gap-3 py-3.5 text-left">
                  <span className="w-12 shrink-0 text-[17px] font-medium tracking-[-0.01em]">{DAY_SHORT[d]}</span>
                  <span className="flex min-w-0 flex-1 items-center gap-1">
                    {lessons.map((l) => (
                      <span key={l.id} className="h-4 w-[3px] shrink-0 rounded-full" style={{ background: SUBJECT_META[l.subject].color }} />
                    ))}
                  </span>
                  <span className="font-mono text-[12px] tabular-nums text-muted">{lessons.length ? `${lessons[0].start}–${lessons[lessons.length - 1].end}` : "–"}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex gap-2">
          <input value={cal} onChange={(e) => setCal(e.target.value)} onBlur={() => void saveCalendar()} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} placeholder="Or a calendar link (.ics)" className="field min-w-0 flex-1 text-[14px]" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="Calendar link" />
          {cal && (
            <button
              type="button"
              className="btn-quiet h-auto rounded-xl bg-surface px-3 text-[13px]"
              onClick={() => {
                setCal("");
                setCalStatus(null);
                hub.write("settings/calendarUrl", null);
              }}
            >
              Clear
            </button>
          )}
        </div>
        {calStatus && <p className="mt-2 px-1 text-[12.5px] text-muted">{calStatus}</p>}
      </Section>

      <Section title="Study">
        <ul className="divide-y divide-line border-y border-line">
          <li>
            <button type="button" onClick={() => setExams(true)} className="tap flex w-full items-center justify-between py-3.5 text-left">
              <span className="text-[17px] font-medium tracking-[-0.01em]">Exams</span>
              <span className="font-mono text-[12px] tabular-nums text-muted">{examCount || "–"}</span>
            </button>
          </li>
          <li className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-[17px] font-medium tracking-[-0.01em]">Stare at Wall</span>
            <span className="grid grid-cols-4 gap-1 rounded-xl bg-surface p-1">
              {STARE_LENGTHS.map((m) => (
                <button key={m} type="button" aria-pressed={school.stareMin === m} onClick={() => hub.write("settings/stareMin", m)} className={cn("h-8 w-11 rounded-lg font-mono text-[12.5px] tabular-nums transition-colors", school.stareMin === m ? "bg-ink text-bg" : "text-ink-2")}>
                  {m}m
                </button>
              ))}
            </span>
          </li>
        </ul>
      </Section>

      <Section title="Photos">
        <ul className="divide-y divide-line border-y border-line">
          <li>
            <button
              type="button"
              onClick={() => setPasscode(vault.state === "none" ? "create" : vault.state === "locked" ? "unlock" : "change")}
              disabled={vault.state === "checking"}
              className="tap flex w-full items-center justify-between py-3.5 text-left disabled:opacity-40"
            >
              <span className="text-[17px] font-medium tracking-[-0.01em]">{vault.state === "none" ? "Set a passcode" : vault.state === "locked" ? "Unlock on this device" : "Change passcode"}</span>
              <span className="text-[12.5px] text-muted">{vault.state === "open" ? "Unlocked" : vault.state === "locked" ? "Locked" : ""}</span>
            </button>
          </li>
          {vault.state === "open" && (
            <li>
              <button type="button" onClick={() => void vault.lock()} className="tap flex w-full items-center justify-between py-3.5 text-left">
                <span className="text-[17px] font-medium tracking-[-0.01em]">Lock this device</span>
              </button>
            </li>
          )}
        </ul>
      </Section>

      <Section title="Claude">
        <button type="button" onClick={() => void copyClaudeLink()} className="tap flex h-14 w-full items-center justify-between rounded-2xl bg-surface px-4 text-left">
          <span className="text-[16px] font-medium">Copy connector link</span>
          <span className="text-[12.5px] text-muted">{claude ?? ""}</span>
        </button>
        {claudeLink && <input readOnly value={claudeLink} onFocus={(e) => e.currentTarget.select()} className="field mt-2 font-mono text-[12px]" aria-label="Connector link" />}
      </Section>

      <Section title="Sound">
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface px-4 py-3.5">
          <div className="min-w-0">
            <div className="text-[15px]">Tick sounds</div>
            <div className="text-[12px] text-muted">Each habit&apos;s own sound, a chime when they&apos;re all done.</div>
          </div>
          <Switch on={settings.soundsOn} onClick={() => updateSettings((s) => ({ ...s, soundsOn: !s.soundsOn }))} label="Tick sounds" />
        </div>
      </Section>

      <Section title="Appearance">
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1">
          {(["system", "light", "dark"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setTheme(c);
                applyTheme(c);
              }}
              aria-pressed={theme === c}
              className={cn("h-10 rounded-xl text-[14px] capitalize transition-colors", theme === c ? "bg-ink text-bg" : "text-ink-2")}
            >
              {c === "system" ? "Auto" : c}
            </button>
          ))}
        </div>
        <p className="mt-2 px-1 text-[12px] text-muted">Auto follows your phone. Set separately on each device.</p>
      </Section>

      <Section title="Sync">
        <div className="flex items-center gap-2.5 px-1 text-[14px] text-ink-2">
          <span className={cn("h-2 w-2 rounded-full", sync === "online" && !pending ? "bg-ink" : "bg-faint")} />
          {syncLine}
        </div>
      </Section>

      <p className="mt-12 text-center font-mono text-[10.5px] uppercase tracking-[0.2em] text-faint">Hugo</p>

      {editing && <HabitSheet habitId={editing} onClose={() => setEditing(null)} />}
      {day !== null && <TimetableSheet day={day} onClose={() => setDay(null)} />}
      {exams && <ExamsSheet onClose={() => setExams(false)} />}
      {passcode && <PasscodeSheet mode={passcode} onClose={() => setPasscode(null)} />}
    </div>
  );
}
