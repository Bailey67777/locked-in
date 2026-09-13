"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { cloudConfigured } from "@/lib/firebase";
import { uid } from "@/lib/model";
import { cn } from "@/lib/cn";
import { ChevronIcon, PlusIcon, TrashIcon } from "./Icons";

export default function SettingsView() {
  const { data, updateSettings, sync } = useStore();
  const habits = data.settings.habits;
  const [newHabit, setNewHabit] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= habits.length) return;
    updateSettings((s) => {
      const next = [...s.habits];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...s, habits: next };
    });
  };

  const rename = (id: string, name: string) =>
    updateSettings((s) => ({ ...s, habits: s.habits.map((h) => (h.id === id ? { ...h, name } : h)) }));

  const remove = (id: string) => {
    updateSettings((s) => ({ ...s, habits: s.habits.filter((h) => h.id !== id) }));
    setConfirmId(null);
  };

  const add = () => {
    const name = newHabit.trim();
    if (!name) return;
    updateSettings((s) => ({ ...s, habits: [...s.habits, { id: uid(), name }] }));
    setNewHabit("");
  };

  const syncLabel =
    sync === "local"
      ? "Local only — data stays on this device"
      : sync === "online"
        ? "Synced with the cloud"
        : sync === "offline"
          ? "Offline — changes will sync when you reconnect"
          : "Connecting…";

  return (
    <div className="rise flex flex-col gap-4">
      <h1 className="px-1 text-2xl font-extrabold text-ink">Settings</h1>

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">Core habits</h2>
        <p className="mb-3 text-sm font-semibold text-ink-muted">
          Rename, reorder, add or remove. Changes apply from today onwards; past days keep what they had.
        </p>
        <ul className="flex flex-col gap-2">
          {habits.map((h, i) => (
            <li key={h.id} className="flex items-center gap-1 rounded-2xl bg-sand-50 p-1.5">
              <div className="flex flex-col">
                <button type="button" className="btn-icon h-7 w-8" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                  <ChevronIcon dir="up" width={16} height={16} />
                </button>
                <button type="button" className="btn-icon h-7 w-8" onClick={() => move(i, 1)} disabled={i === habits.length - 1} aria-label="Move down">
                  <ChevronIcon dir="down" width={16} height={16} />
                </button>
              </div>
              <AutoTextarea
                value={h.name}
                onChange={(v) => rename(h.id, v)}
                onBlur={(v) => {
                  if (!v.trim()) rename(h.id, "Untitled habit");
                }}
                ariaLabel={`Habit ${i + 1} name`}
              />
              {confirmId === h.id ? (
                <div className="flex items-center gap-1">
                  <button type="button" className="tap rounded-xl bg-sunset-500 px-3 py-2 text-xs font-extrabold text-white" onClick={() => remove(h.id)}>
                    Remove
                  </button>
                  <button type="button" className="btn-ghost px-2 py-2 text-xs" onClick={() => setConfirmId(null)}>
                    Keep
                  </button>
                </div>
              ) : (
                <button type="button" className="btn-icon" onClick={() => setConfirmId(h.id)} aria-label="Remove habit">
                  <TrashIcon />
                </button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input value={newHabit} onChange={(e) => setNewHabit(e.target.value)} placeholder="New habit, e.g. 15 min outside at lunch" className="field" autoComplete="off" />
          <button type="submit" className="btn-primary px-4" disabled={!newHabit.trim()} aria-label="Add habit">
            <PlusIcon />
          </button>
        </form>
        <p className="mt-3 text-xs font-semibold text-ink-muted">Tip: keep it to six or so. Fewer things, done every day, is the whole idea.</p>
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">Your name</h2>
        <p className="mb-2 text-sm font-semibold text-ink-muted">Used in the greeting on the Today screen.</p>
        <input
          value={data.settings.name}
          onChange={(e) => updateSettings((s) => ({ ...s, name: e.target.value }))}
          onBlur={(e) => {
            if (!e.target.value.trim()) updateSettings((s) => ({ ...s, name: "Hugo" }));
          }}
          className="field"
          autoComplete="off"
        />
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">Sync</h2>
        <div className="mt-2 flex items-center gap-2 text-sm font-bold text-ink-soft">
          <span className={cn("h-2.5 w-2.5 rounded-full", sync === "online" ? "bg-teal-500" : sync === "offline" ? "bg-sunset-500" : sync === "local" ? "bg-sand-400" : "bg-ocean-300")} />
          {syncLabel}
        </div>
        {!cloudConfigured && (
          <p className="mt-2 text-xs font-semibold text-ink-muted">
            To see the same data on your phone and laptop, add the Firebase variables from <code>.env.example</code> (see README) and redeploy.
          </p>
        )}
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">Your photos</h2>
        <p className="mt-1 text-sm font-semibold text-ink-soft">
          Drop <code className="rounded bg-sand-100 px-1">hero.jpg</code> and <code className="rounded bg-sand-100 px-1">profile.jpg</code> into{" "}
          <code className="rounded bg-sand-100 px-1">public/photos/</code> and redeploy. The placeholders are replaced automatically.
        </p>
      </section>
    </div>
  );
}

/** One-line textarea that grows to fit long habit names on narrow screens. */
function AutoTextarea({ value, onChange, onBlur, ariaLabel }: { value: string; onChange: (v: string) => void; onBlur: (v: string) => void; ariaLabel: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      onBlur={(e) => onBlur(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className="field min-w-0 flex-1 resize-none overflow-hidden border-transparent bg-transparent px-2 py-2 text-[15px] font-bold leading-snug focus:bg-white"
      aria-label={ariaLabel}
    />
  );
}
