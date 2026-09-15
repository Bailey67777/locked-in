"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { cloudConfigured } from "@/lib/firebase";
import { uid } from "@/lib/model";
import { AUTO_EMOJIS, DEFAULT_COLOR, EMOJI_SUGGESTIONS, HABIT_COLORS } from "@/lib/defaults";
import { SOUNDS, playSound } from "@/lib/sounds";
import { cn } from "@/lib/cn";
import type { HabitDef } from "@/lib/types";
import { ChevronIcon, PlusIcon, TrashIcon } from "./Icons";

export default function SettingsView() {
  const { data, updateSettings, sync } = useStore();
  const settings = data.settings;
  const habits = settings.habits;
  const [newHabit, setNewHabit] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [emojiFor, setEmojiFor] = useState<string | null>(null);

  const patch = (id: string, changes: Partial<HabitDef>) =>
    updateSettings((s) => ({ ...s, habits: s.habits.map((h) => (h.id === id ? { ...h, ...changes } : h)) }));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= habits.length) return;
    updateSettings((s) => {
      const next = [...s.habits];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...s, habits: next };
    });
  };

  const remove = (id: string) => {
    updateSettings((s) => ({ ...s, habits: s.habits.filter((h) => h.id !== id) }));
    setConfirmId(null);
  };

  const add = () => {
    const name = newHabit.trim();
    if (!name) return;
    const sound = SOUNDS[habits.length % SOUNDS.length].id;
    const color = HABIT_COLORS[habits.length % HABIT_COLORS.length].hex;
    const emoji = AUTO_EMOJIS[habits.length % AUTO_EMOJIS.length];
    updateSettings((s) => ({ ...s, habits: [...s.habits, { id: uid(), name, emoji, color, sound }] }));
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
          Give each one an emoji, a colour, a time and a sound. Habits with a time sort themselves into day order. Changes apply from today onwards; past days keep what they had.
        </p>
        <ul className="flex flex-col gap-3">
          {habits.map((h, i) => {
            const color = h.color ?? DEFAULT_COLOR;
            const canMove = !h.time; // timed habits are ordered by their time
            return (
              <li key={h.id} className="rounded-2xl bg-sand-50 p-2.5" style={{ borderLeft: `5px solid ${color}` }}>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEmojiFor(emojiFor === h.id ? null : h.id)}
                    className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-soft"
                    aria-label="Change emoji"
                    title="Change emoji"
                  >
                    {h.emoji ?? "🔹"}
                  </button>
                  <AutoTextarea
                    value={h.name}
                    onChange={(v) => patch(h.id, { name: v })}
                    onBlur={(v) => {
                      if (!v.trim()) patch(h.id, { name: "Untitled habit" });
                    }}
                    ariaLabel={`Habit ${i + 1} name`}
                  />
                  <div className="flex flex-col">
                    <button type="button" className="btn-icon h-6 w-7" onClick={() => move(i, -1)} disabled={!canMove || i === 0} aria-label="Move up" title={canMove ? "Move up" : "Timed habits are ordered by time"}>
                      <ChevronIcon dir="up" width={14} height={14} />
                    </button>
                    <button type="button" className="btn-icon h-6 w-7" onClick={() => move(i, 1)} disabled={!canMove || i === habits.length - 1} aria-label="Move down" title={canMove ? "Move down" : "Timed habits are ordered by time"}>
                      <ChevronIcon dir="down" width={14} height={14} />
                    </button>
                  </div>
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
                    <button type="button" className="btn-icon h-9 w-9" onClick={() => setConfirmId(h.id)} aria-label="Remove habit">
                      <TrashIcon />
                    </button>
                  )}
                </div>

                {emojiFor === h.id && (
                  <div className="pop-in mt-2 rounded-xl bg-white p-2 shadow-soft">
                    <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
                      {EMOJI_SUGGESTIONS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => {
                            patch(h.id, { emoji: e });
                            setEmojiFor(null);
                          }}
                          className={cn("tap flex h-9 items-center justify-center rounded-lg text-xl hover:bg-sand-100", h.emoji === e && "bg-ocean-100")}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                    <input
                      className="field mt-2 py-2 text-base"
                      placeholder="Or type any emoji here"
                      maxLength={8}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        if (v) patch(h.id, { emoji: v });
                      }}
                    />
                  </div>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="flex items-center gap-1" role="radiogroup" aria-label="Colour">
                    {HABIT_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        role="radio"
                        aria-checked={color === c.hex}
                        title={c.name}
                        onClick={() => patch(h.id, { color: c.hex })}
                        className={cn("tap h-6 w-6 rounded-full border-2 transition-transform", color === c.hex ? "scale-110 border-ink" : "border-white")}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-ink-muted">
                    <span>⏰</span>
                    <input
                      type="time"
                      value={h.time ?? ""}
                      onChange={(e) => patch(h.id, { time: e.target.value || undefined })}
                      className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-sm font-bold text-ink"
                      aria-label="Time of day"
                    />
                    {h.time && (
                      <button type="button" className="text-[11px] font-bold text-ink-muted hover:text-ink" onClick={() => patch(h.id, { time: undefined })}>
                        clear
                      </button>
                    )}
                  </label>
                  <SoundPicker value={h.sound ?? "pop"} onChange={(sound) => patch(h.id, { sound })} />
                </div>
              </li>
            );
          })}
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-ink">Sounds</h2>
            <p className="text-sm font-semibold text-ink-muted">Little noises when you tick things. Silent mode on your phone still mutes them.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.soundsOn}
            onClick={() => updateSettings((s) => ({ ...s, soundsOn: !s.soundsOn }))}
            className={cn("tap relative h-8 w-14 shrink-0 rounded-full transition-colors", settings.soundsOn ? "bg-teal-500" : "bg-sand-300")}
            aria-label="Sounds on or off"
          >
            <span className={cn("absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all", settings.soundsOn ? "left-7" : "left-1")} />
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-ink">To-do ticked</span>
            <SoundPicker value={settings.todoSound} onChange={(todoSound) => updateSettings((s) => ({ ...s, todoSound }))} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-ink">All habits done</span>
            <SoundPicker value={settings.dayCompleteSound} onChange={(dayCompleteSound) => updateSettings((s) => ({ ...s, dayCompleteSound }))} />
          </div>
        </div>
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">Your name</h2>
        <p className="mb-2 text-sm font-semibold text-ink-muted">Used in the greeting on the Today screen.</p>
        <input
          value={settings.name}
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
          Drop files into <code className="rounded bg-sand-100 px-1">public/photos/</code> and push: <code className="rounded bg-sand-100 px-1">hero.jpg</code> (banner),{" "}
          <code className="rounded bg-sand-100 px-1">profile.jpg</code> (avatar), and <code className="rounded bg-sand-100 px-1">wall-1.jpg</code> to{" "}
          <code className="rounded bg-sand-100 px-1">wall-4.jpg</code> (the side column on a laptop). Per-day photos are added from the day itself.
        </p>
      </section>
    </div>
  );
}

function SoundPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <span className="flex items-center gap-1">
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          playSound(e.target.value);
        }}
        className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-sm font-bold text-ink"
        aria-label="Sound"
      >
        {SOUNDS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.emoji} {s.name}
          </option>
        ))}
      </select>
      <button type="button" className="btn-icon h-8 w-8 text-base" onClick={() => playSound(value)} aria-label="Play sound" title="Play">
        ▶
      </button>
    </span>
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
