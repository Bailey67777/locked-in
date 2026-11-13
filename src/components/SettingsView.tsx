"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/model";
import { MAX_HABITS } from "@/lib/defaults";
import { applyTheme, readTheme, type ThemeChoice } from "@/lib/theme";
import { cloudConfigured } from "@/lib/firebase";
import { cn } from "@/lib/cn";
import { ChevronIcon, CloseIcon, PlusIcon } from "./Icons";

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
  const settings = data.settings;
  const habits = settings.habits;
  const [draft, setDraft] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeChoice>(() => (typeof window === "undefined" ? "system" : readTheme()));

  const patch = (id: string, changes: { name?: string; time?: string }) =>
    updateSettings((s) => ({ ...s, habits: s.habits.map((h) => (h.id === id ? { ...h, ...changes } : h)) }));
  const move = (i: number, dir: -1 | 1) =>
    updateSettings((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.habits.length) return s;
      const next = [...s.habits];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...s, habits: next };
    });
  const add = () => {
    const name = draft.trim();
    if (!name || habits.length >= MAX_HABITS) return;
    updateSettings((s) => ({ ...s, habits: [...s.habits, { id: uid(), name }] }));
    setDraft("");
  };

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
        <div className="label">Settings</div>
        <h1 className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.035em]">Settings</h1>
      </header>

      <Section title="Habits" aside={`${habits.length}/${MAX_HABITS}`}>
        <ul className="divide-y divide-line border-y border-line">
          {habits.map((h, i) => (
            <li key={h.id} className="flex items-center gap-1.5 py-1.5">
              <input
                key={`${h.id}:${h.name}`}
                defaultValue={h.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== h.name) patch(h.id, { name: v });
                  else e.target.value = h.name;
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-2 text-[16px] tracking-[-0.01em] focus:bg-surface focus:outline-none"
                aria-label={`Habit ${i + 1}`}
              />
              <input
                type="time"
                value={h.time ?? ""}
                onChange={(e) => patch(h.id, { time: e.target.value || undefined })}
                className={cn("w-[76px] shrink-0 rounded-lg bg-transparent px-1 py-2 text-right font-mono text-[12px] tabular-nums focus:bg-surface focus:outline-none", h.time ? "text-ink-2" : "text-faint")}
                aria-label={`Time for ${h.name}`}
              />
              <span className="flex shrink-0 flex-col">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="flex h-5 w-7 items-center justify-center text-muted disabled:opacity-20" aria-label={`Move ${h.name} up`}>
                  <ChevronIcon dir="up" width={14} height={14} />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === habits.length - 1} className="flex h-5 w-7 items-center justify-center text-muted disabled:opacity-20" aria-label={`Move ${h.name} down`}>
                  <ChevronIcon dir="down" width={14} height={14} />
                </button>
              </span>
              {confirm === h.id ? (
                <button
                  type="button"
                  className="h-8 shrink-0 rounded-full bg-ink px-3 text-[12px] font-medium text-bg"
                  onClick={() => {
                    setConfirm(null);
                    updateSettings((s) => ({ ...s, habits: s.habits.filter((x) => x.id !== h.id) }));
                  }}
                >
                  Remove
                </button>
              ) : (
                <button type="button" onClick={() => setConfirm(h.id)} className="flex h-8 w-8 shrink-0 items-center justify-center text-muted" aria-label={`Remove ${h.name}`}>
                  <CloseIcon width={15} height={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
        {habits.length < MAX_HABITS ? (
          <form
            className="mt-3 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a habit" className="field" enterKeyHint="done" autoComplete="off" />
            <button type="submit" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-bg disabled:opacity-30" disabled={!draft.trim()} aria-label="Add habit">
              <PlusIcon />
            </button>
          </form>
        ) : (
          <p className="mt-3 text-[12px] text-muted">Ten is the limit. Remove one to add another.</p>
        )}
        <p className="mt-3 text-[12px] leading-relaxed text-muted">Tap a name to rename it. Times are optional. Changes apply from today; past days keep their own list.</p>
      </Section>

      <Section title="Sound">
        <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3.5">
          <div>
            <div className="text-[15px]">Tick sounds</div>
            <div className="text-[12px] text-muted">A soft click, a chime when all ten are done.</div>
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
    </div>
  );
}
