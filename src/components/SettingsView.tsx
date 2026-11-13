"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { soundName } from "@/lib/sounds";
import { useEditBank } from "@/lib/edits";
import { applyTheme, readTheme, type ThemeChoice } from "@/lib/theme";
import { cloudConfigured } from "@/lib/firebase";
import { cn } from "@/lib/cn";
import { ChevronIcon } from "./Icons";
import HabitSheet from "./HabitSheet";

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

      <Section title="Habits" aside="10">
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
        <p className="mt-3 text-[12px] leading-relaxed text-muted">Ten, always. Tap one to rename it, pick its sound or give it an edit. The top one is your must-do: days you miss it get a slash on the calendar.</p>
      </Section>

      <Section title="Sound">
        <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3.5">
          <div>
            <div className="text-[15px]">Tick sounds</div>
            <div className="text-[12px] text-muted">Each habit&apos;s own sound, a chime when all ten are done.</div>
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

      <Section title="Add to Home Screen">
        <div className="rounded-2xl bg-surface px-4 py-4 text-[14px] leading-relaxed text-ink-2">
          <p>
            <span className="text-ink">iPhone or iPad.</span> Open this page in Chrome or Safari, tap the Share button (the square with an arrow, in the address bar on iPhone or top right on iPad), then
            Add to Home Screen, then Add.
          </p>
          <p className="mt-3">
            <span className="text-ink">Already have the old icon?</span> Press and hold it, Remove App, then add it again so the new icon shows.
          </p>
        </div>
      </Section>

      <Section title="Sync">
        <div className="flex items-center gap-2.5 px-1 text-[14px] text-ink-2">
          <span className={cn("h-2 w-2 rounded-full", sync === "online" && !pending ? "bg-ink" : "bg-faint")} />
          {syncLine}
        </div>
      </Section>

      <p className="mt-12 text-center font-mono text-[10.5px] uppercase tracking-[0.2em] text-faint">Locked In</p>

      {editing && <HabitSheet habitId={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
