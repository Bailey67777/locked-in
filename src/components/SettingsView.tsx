"use client";

import { useEffect, useRef, useState } from "react";
import { askBrowserPermission, browserNotificationsSupported, buildIcs, downloadText, randomTopic, sendTestPush } from "@/lib/reminders";
import { useStore } from "@/lib/store";
import { cloudConfigured } from "@/lib/firebase";
import { REWARD_PCT, formatBytes, uid } from "@/lib/model";
import { VLOG_BUDGET_BYTES, VLOG_MAX_SECONDS, storedSize } from "@/lib/vlog";
import { EDIT_MAX_BYTES, deleteEdit, renameEdit, uploadEdit, useEditBank } from "@/lib/edits";
import { formatClock } from "@/lib/model";
import { SEASONS, SEASON_EMOJI, SEASON_LABEL } from "@/lib/season";
import type { Countdown } from "@/lib/types";
import { addDays, formatDateTime } from "@/lib/dates";
import { AUTO_EMOJIS, DEFAULT_COLOR, EMOJI_SUGGESTIONS, HABIT_COLORS } from "@/lib/defaults";
import { SOUNDS, pickSoundForHabit, playRandomSound, playSound, randomSound, soundById } from "@/lib/sounds";
import { cn } from "@/lib/cn";
import type { HabitDef } from "@/lib/types";
import { ChevronIcon, PlusIcon, TrashIcon } from "./Icons";
import PhotosSettings from "./PhotosSettings";
import DayPlanner from "./DayPlanner";
import EditPlayer from "./EditPlayer";

export default function SettingsView() {
  const { data, updateSettings, sync, today, season, seasonChoice, setSeasonChoice } = useStore();
  const [planningDate, setPlanningDate] = useState<string | null>(null);
  const [cd, setCd] = useState({ title: "", date: "", time: "09:00", color: HABIT_COLORS[2].hex, emoji: "" });
  const [cdConfirm, setCdConfirm] = useState<string | null>(null);
  const [pushTest, setPushTest] = useState<"idle" | "sending" | "ok" | "fail">("idle");
  const [topicCopied, setTopicCopied] = useState(false);
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
    const sound = pickSoundForHabit(name, habits.map((h) => h.sound));
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
    <div className="rise flex flex-col gap-3">
      <h1 className="px-1 pb-1 font-serif text-[28px] leading-none text-ink">Settings</h1>

      {(() => {
        const tomorrow = addDays(today, 1);
        const day = data.days[tomorrow];
        const written = Boolean(day?.list);
        const n = written ? day!.todos.length : 0;
        const withEdits = written ? day!.todos.filter((t) => t.editId).length : 0;
        return (
          <section className="card p-4">
            <h2 className="card-title">Tomorrow&apos;s To Do</h2>
            <p className="card-desc mt-1">
              {written
                ? `Written: ${n} ${n === 1 ? "thing" : "things"}${withEdits ? `, ${withEdits} with an edit` : ""}. Open it to change anything.`
                : "Not written yet. Import today's list, add your habits, change what you need, and pick an edit for anything you want to earn."}
            </p>
            <button type="button" className="btn-primary mt-3 w-full" onClick={() => setPlanningDate(tomorrow)}>
              ✍️ Write the next day
            </button>
          </section>
        );
      })()}

      <PhotosSettings season={season} />

      <section className="card p-4">
        <h2 className="card-title">Core habits</h2>
        <p className="card-desc mb-3 mt-1">
          Your habits, each with an emoji, a colour, a time and a sound. Add them to a day&apos;s To Do when you write it; a day you don&apos;t write starts with all of them. Past days keep what they had.
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
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(h.keystone)}
                    onClick={() => patch(h.id, { keystone: !h.keystone })}
                    title="A must-do habit has to be ticked to unlock the reward video"
                    className={cn("tap rounded-full px-3 py-1 text-xs font-extrabold", h.keystone ? "bg-sunset-500 text-white" : "bg-white text-ink-muted shadow-soft")}
                  >
                    {h.keystone ? "⭐ Must-do" : "☆ Must-do"}
                  </button>
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

      <section className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="card-title">Sounds</h2>
            <p className="card-desc mt-1">Fifty daft ones: school teachers, goats, weird whistles and old tunes on silly instruments. All the same loudness. Silent mode on your phone still mutes them.</p>
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
          <div className="flex items-center justify-between gap-3 rounded-xl bg-sand-50 px-3 py-2.5">
            <div>
              <div className="text-sm font-bold text-ink">🎲 Lucky dip</div>
              <p className="card-desc">Every tick plays a different random sound, and you hear all fifty before any repeats. Turn it off to give each habit its own.</p>
            </div>
            <Toggle on={settings.randomSounds} onClick={() => updateSettings((s) => ({ ...s, randomSounds: !s.randomSounds }))} label="Lucky dip: random sound every tick" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-ink">Hear one</span>
            <button type="button" className="btn-ghost bg-sand-50" onClick={() => playRandomSound()}>
              ▶ Play a random sound
            </button>
          </div>
          <div className={cn("flex flex-wrap items-center justify-between gap-2", settings.randomSounds && "opacity-50")}>
            <span className="text-sm font-bold text-ink">Every habit{settings.randomSounds ? " (lucky dip is on)" : ""}</span>
            <button
              type="button"
              className="btn-ghost bg-sand-50"
              onClick={() =>
                updateSettings((st) => {
                  const used: string[] = [];
                  return {
                    ...st,
                    habits: st.habits.map((h) => {
                      const sound = pickSoundForHabit(h.name, used);
                      used.push(sound);
                      return { ...h, sound };
                    }),
                  };
                })
              }
            >
              🎲 Shuffle all habit sounds
            </button>
          </div>
          <div className={cn("flex flex-wrap items-center justify-between gap-2", settings.randomSounds && "opacity-50")}>
            <span className="text-sm font-bold text-ink">To-do ticked{settings.randomSounds ? " (lucky dip is on)" : ""}</span>
            <SoundPicker value={settings.todoSound} onChange={(todoSound) => updateSettings((s) => ({ ...s, todoSound }))} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-ink">All habits done</span>
            <SoundPicker value={settings.dayCompleteSound} onChange={(dayCompleteSound) => updateSettings((s) => ({ ...s, dayCompleteSound }))} />
          </div>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="card-title">First A-level exam</h2>
        <p className="card-desc mt-1">Drives the countdown on Today and the end of the Study graph. Linear A-levels, so probably May 2028; set it once you know.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={settings.examDate ?? ""}
            onChange={(e) => updateSettings((st) => ({ ...st, examDate: e.target.value || undefined }))}
            className="rounded-lg border border-sand-200 bg-white px-2 py-2 text-sm font-bold text-ink"
            aria-label="First A-level exam date"
          />
          {settings.examDate && (
            <button type="button" className="text-xs font-bold text-ink-muted hover:text-ink" onClick={() => updateSettings((st) => ({ ...st, examDate: undefined }))}>
              clear
            </button>
          )}
        </div>
      </section>

      <section className="card p-4">
        <h2 className="card-title">Countdowns</h2>
        <p className="card-desc mt-1">Shown on Today, live to the second. Tests, matches, trips, results day.</p>
        {settings.countdowns.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {[...settings.countdowns]
              .sort((a, b) => a.at.localeCompare(b.at))
              .map((c) => (
                <li key={c.id} className="flex items-center gap-2 rounded-2xl bg-sand-50 px-3 py-2" style={{ borderLeft: `5px solid ${c.color}` }}>
                  <span className="text-xl leading-none">{c.emoji ?? "⏳"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold text-ink">{c.title}</div>
                    <div className="text-[11px] font-bold text-ink-muted">{formatDateTime(c.at)}</div>
                  </div>
                  {cdConfirm === c.id ? (
                    <div className="flex items-center gap-1">
                      <button type="button" className="tap rounded-xl bg-sunset-500 px-3 py-2 text-xs font-extrabold text-white" onClick={() => { updateSettings((st) => ({ ...st, countdowns: st.countdowns.filter((x) => x.id !== c.id) })); setCdConfirm(null); }}>
                        Delete
                      </button>
                      <button type="button" className="btn-ghost px-2 py-2 text-xs" onClick={() => setCdConfirm(null)}>
                        Keep
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="btn-icon h-9 w-9" onClick={() => setCdConfirm(c.id)} aria-label={`Delete countdown ${c.title}`}>
                      <TrashIcon />
                    </button>
                  )}
                </li>
              ))}
          </ul>
        )}
        <form
          className="mt-3 flex flex-col gap-2 rounded-2xl bg-sand-50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const title = cd.title.trim();
            if (!title || !cd.date) return;
            const item: Countdown = { id: uid(), title, at: `${cd.date}T${cd.time || "09:00"}`, color: cd.color, emoji: cd.emoji || undefined };
            updateSettings((st) => ({ ...st, countdowns: [...st.countdowns, item] }));
            setCd({ title: "", date: "", time: "09:00", color: HABIT_COLORS[2].hex, emoji: "" });
          }}
        >
          <div className="text-sm font-extrabold text-ink">New countdown</div>
          <input className="field py-2" value={cd.title} onChange={(e) => setCd({ ...cd, title: e.target.value })} placeholder="e.g. Physics mock, half term, first league game" autoComplete="off" />
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className="rounded-lg border border-sand-200 bg-white px-2 py-2 text-sm font-bold text-ink" value={cd.date} min={addDays(today, 0)} onChange={(e) => setCd({ ...cd, date: e.target.value })} aria-label="Countdown date" />
            <input type="time" className="rounded-lg border border-sand-200 bg-white px-2 py-2 text-sm font-bold text-ink" value={cd.time} onChange={(e) => setCd({ ...cd, time: e.target.value })} aria-label="Countdown time" />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {HABIT_COLORS.map((hc) => (
              <button key={hc.hex} type="button" title={hc.name} onClick={() => setCd({ ...cd, color: hc.hex })} className={cn("tap h-6 w-6 rounded-full border-2", cd.color === hc.hex ? "scale-110 border-ink" : "border-white")} style={{ backgroundColor: hc.hex }} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {["🎓", "📝", "🏀", "✈️", "🎂", "🎄", "🏖️", "🎸", "🏁", "❤️", "🎉", "⏳"].map((e) => (
              <button key={e} type="button" onClick={() => setCd({ ...cd, emoji: cd.emoji === e ? "" : e })} className={cn("tap flex h-9 w-9 items-center justify-center rounded-lg text-lg", cd.emoji === e ? "bg-ocean-100" : "hover:bg-sand-100")}>
                {e}
              </button>
            ))}
          </div>
          <button type="submit" className="btn-primary" disabled={!cd.title.trim() || !cd.date}>
            <PlusIcon /> Add countdown
          </button>
        </form>
      </section>

      <section className="card p-4">
        <h2 className="card-title">Season</h2>
        <p className="card-desc mt-1">The colours and banner follow the seasons in Bristol and switch on their own. Pick one to preview it on this device. Banner photos for each season are under Photos at the top.</p>
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {(["auto", ...SEASONS] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSeasonChoice(c)}
              aria-pressed={seasonChoice === c}
              className={cn("tap rounded-xl border px-1 py-2 text-center text-[12px] font-bold", seasonChoice === c ? "border-transparent bg-ink text-white" : "border-white/70 bg-white/50 text-ink-soft hover:bg-white/80")}
            >
              <div className="text-base leading-none">{c === "auto" ? "🔄" : SEASON_EMOJI[c]}</div>
              <div className="mt-1">{c === "auto" ? "Auto" : SEASON_LABEL[c]}</div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] font-semibold text-ink-muted">
          Now showing {SEASON_LABEL[season].toLowerCase()}.
        </p>
      </section>

      <section className="card p-4">
        <h2 className="card-title">Claude sync</h2>
        <p className="card-desc mt-1">Each night Claude reads your day, writes tomorrow&apos;s economics, and updates your grade trajectory from the marks you&apos;ve given it.</p>
        <dl className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-sand-50 px-3 py-2">
            <dt className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">Last read from the app</dt>
            <dd className="text-sm font-extrabold text-ink">{fmtWhen(data.study.sync.lastRead)}</dd>
          </div>
          <div className="rounded-2xl bg-sand-50 px-3 py-2">
            <dt className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">Last write to the app</dt>
            <dd className="text-sm font-extrabold text-ink">{fmtWhen(data.study.sync.lastWrite)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] font-semibold text-ink-muted">Setup lives in <code className="rounded bg-sand-100 px-1">docs/NIGHTLY_CLAUDE_TASK.md</code> in the repo. Your journal is never sent to Claude.</p>
      </section>

      <section className="card p-4">
        <h2 className="card-title">Reminders</h2>
        <p className="card-desc mt-1">
          A reminder at each habit&apos;s time, plus a nudge to submit the day at{" "}
          <input
            type="time"
            value={settings.reminders.submitTime}
            onChange={(e) => e.target.value && updateSettings((st) => ({ ...st, reminders: { ...st.reminders, submitTime: e.target.value } }))}
            className="rounded-lg border border-sand-200 bg-white px-2 py-0.5 text-sm font-bold text-ink"
            aria-label="Submit reminder time"
          />
          . Only habits with a time set get one.
        </p>

        <div className="mt-4 rounded-2xl bg-sand-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-ink">📲 Push to your phone (ntfy app)</div>
              <p className="text-xs font-semibold text-ink-muted">Websites can&apos;t send push to an iPhone unless they&apos;re installed from Safari, so this goes through a free app called ntfy instead.</p>
            </div>
            <Toggle
              on={settings.reminders.ntfy}
              label="Phone push on or off"
              onClick={() => updateSettings((st) => ({ ...st, reminders: { ...st.reminders, ntfy: !st.reminders.ntfy, ntfyTopic: st.reminders.ntfyTopic || randomTopic() } }))}
            />
          </div>
          {settings.reminders.ntfy && (
            <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-xs font-semibold text-ink-soft">
              <li>Install <span className="font-extrabold">ntfy</span> from the App Store (or Play Store).</li>
              <li>
                In ntfy tap + and subscribe to this topic. Treat it like a password:
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-2 py-1.5 text-[13px] font-bold text-ink">{settings.reminders.ntfyTopic}</code>
                  <button
                    type="button"
                    className="btn-ghost bg-white px-2 py-1.5 text-xs"
                    onClick={() => {
                      navigator.clipboard?.writeText(settings.reminders.ntfyTopic).catch(() => undefined);
                      setTopicCopied(true);
                      window.setTimeout(() => setTopicCopied(false), 1500);
                    }}
                  >
                    {topicCopied ? "Copied ✓" : "Copy"}
                  </button>
                </div>
              </li>
              <li>
                <button
                  type="button"
                  className="btn-ghost bg-white px-2 py-1.5 text-xs"
                  disabled={pushTest === "sending"}
                  onClick={async () => {
                    setPushTest("sending");
                    setPushTest((await sendTestPush(settings.reminders.ntfyTopic)) ? "ok" : "fail");
                  }}
                >
                  Send a test
                </button>{" "}
                {pushTest === "ok" && <span className="text-teal-600">Sent. It should buzz within a few seconds.</span>}
                {pushTest === "fail" && <span className="text-sunset-600">Couldn&apos;t reach ntfy. Check your connection.</span>}
              </li>
              <li>That&apos;s it. Each time you open Locked In it schedules the rest of that day&apos;s reminders, so open it once in the morning.</li>
            </ol>
          )}
          {settings.reminders.ntfy && <p className="mt-2 text-[11px] font-semibold text-ink-muted">Heads up: reminder text (your habit names) passes through ntfy.sh&apos;s servers. Anyone who knows the topic could read them, which is why it&apos;s random.</p>}
        </div>

        <div className="mt-3 rounded-2xl bg-sand-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-ink">💻 Notifications while the app is open</div>
              <p className="text-xs font-semibold text-ink-muted">{browserNotificationsSupported() ? "Works on a laptop or Android while a Locked In tab is open." : "This browser doesn't support it (Chrome on iPhone never does). Use the phone push above."}</p>
            </div>
            {browserNotificationsSupported() && (
              <Toggle
                on={settings.reminders.browser}
                label="Browser notifications on or off"
                onClick={async () => {
                  if (settings.reminders.browser) return updateSettings((st) => ({ ...st, reminders: { ...st.reminders, browser: false } }));
                  if (await askBrowserPermission()) updateSettings((st) => ({ ...st, reminders: { ...st.reminders, browser: true } }));
                }}
              />
            )}
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-sand-50 p-3">
          <div className="text-sm font-extrabold text-ink">📅 Or put them in your phone&apos;s calendar</div>
          <p className="text-xs font-semibold text-ink-muted">Downloads a calendar file of daily repeating alarms at your habit times. Open it on your phone and add it to Calendar. No app needed, but you re-download it if you change the times.</p>
          <button type="button" className="btn-ghost mt-2 bg-white" onClick={() => downloadText("locked-in-reminders.ics", buildIcs(settings, today), "text/calendar")}>
            Download reminders (.ics)
          </button>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="card-title">Vlogs</h2>
        <p className="card-desc mt-1">
          Film one from the Calendar: tap the camera on today, take the photo, and the recorder opens. Up to {Math.round(VLOG_MAX_SECONDS / 60)} minutes each. They are stored like your photos and journal (no passphrase) and never go to
          Claude.
        </p>
        {(() => {
          const vlogs = Object.values(data.days).filter((d) => d.vlog);
          const used = vlogs.reduce((n, d) => n + storedSize(d.vlog!.bytes), 0);
          const pct = Math.min(100, Math.round((used / VLOG_BUDGET_BYTES) * 100));
          const room = vlogs.length ? Math.max(0, Math.floor((VLOG_BUDGET_BYTES - used) / (used / vlogs.length))) : null;
          return (
            <div className="mt-3 rounded-xl bg-sand-50 px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-3 text-sm font-bold text-ink">
                <span>
                  {vlogs.length} {vlogs.length === 1 ? "vlog" : "vlogs"} saved
                </span>
                <span className="font-mono text-[11.5px] tabular-nums text-ink-muted">
                  {formatBytes(used)} of {formatBytes(VLOG_BUDGET_BYTES)}
                </span>
              </div>
              <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-black/[0.06]" aria-hidden="true">
                <div className={cn("h-full rounded-full", pct >= 85 ? "bg-sunset-500" : "grad-fill")} style={{ width: `${Math.max(pct, vlogs.length ? 2 : 0)}%` }} />
              </div>
              <p className="card-desc mt-2">
                {room === null ? "The free storage holds roughly 240 one-minute vlogs, or 120 two-minute ones." : `Room for about ${room} more at your usual length.`} When it fills up, open an old day in the Calendar, save its vlog to your
                device, then delete it there.
              </p>
            </div>
          );
        })()}
      </section>

      <EditBankCard />

      <section className="card p-4">
        <h2 className="card-title">Reward video</h2>
        <p className="mt-1 text-sm font-semibold text-ink-soft">
          Plays when you submit a day at {REWARD_PCT}% or more with every ⭐ must-do ticked. Anything less is just logged, no punishment. The file lives at{" "}
          <code className="rounded bg-sand-100 px-1">public/media/day-80-100.mp4</code> on GitHub (25 MB max on the website).
        </p>
      </section>

      <section className="card p-4">
        <h2 className="card-title">Your name</h2>
        <p className="card-desc mb-2 mt-1">Used in the greeting on the Today screen.</p>
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

      <section className="card p-4">
        <h2 className="card-title">Sync</h2>
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

      {planningDate && <DayPlanner date={planningDate} onClose={() => setPlanningDate(null)} />}
    </div>
  );
}

/** Every edit in the bank: preview, rename, delete, or upload a new one. */
function EditBankCard() {
  const { data } = useStore();
  const bank = useEditBank();
  const [preview, setPreview] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const vlogBytes = Object.values(data.days).reduce((n, d) => n + (d.vlog ? storedSize(d.vlog.bytes) : 0), 0);
  const editBytes = bank.list.reduce((n, e) => n + storedSize(e.bytes), 0);
  const inUse = new Set(Object.values(data.days).flatMap((d) => d.todos.map((t) => t.editId).filter(Boolean)));

  const upload = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    setError(null);
    setUploading(0);
    try {
      await uploadEdit(file, (f) => setUploading(f));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that.");
    } finally {
      setUploading(null);
    }
  };

  return (
    <section className="card p-4">
      <input ref={input} type="file" accept="video/*" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
      <h2 className="card-title">Edit bank</h2>
      <p className="card-desc mt-1">
        Short videos that play when you tick something. Attach them while writing a day (the 🎬 button). Up to {EDIT_MAX_BYTES / 1024 / 1024} MB each. Vlogs and edits share {formatBytes(VLOG_BUDGET_BYTES)}: {formatBytes(vlogBytes + editBytes)} used.
      </p>
      <button type="button" className="btn-ghost mt-3 bg-white/70" onClick={() => input.current?.click()} disabled={uploading !== null || vlogBytes + editBytes >= VLOG_BUDGET_BYTES}>
        <PlusIcon width={15} height={15} /> {uploading !== null ? `Uploading… ${Math.round(uploading * 100)}%` : "Upload an edit"}
      </button>
      {error && <p className="mt-2 text-[12px] font-bold text-sunset-600">{error}</p>}
      {bank.list.length > 0 && (
        <ul className="mt-3 divide-y divide-black/[0.06] overflow-hidden rounded-xl bg-sand-50">
          {bank.list.map((e) => (
            <li key={e.id} className="flex items-center gap-2.5 px-2.5 py-2">
              <button type="button" onClick={() => setPreview(e.id)} className="tap relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-black/80" aria-label={`Play ${e.name}`}>
                {e.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.thumb} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-sm">🎬</span>
                )}
                <span className="absolute inset-0 flex items-center justify-center text-[11px] text-white/90">▶</span>
              </button>
              <div className="min-w-0 flex-1">
                <input
                  key={`${e.id}:${e.name}`}
                  defaultValue={e.name}
                  onBlur={(ev) => ev.target.value.trim() && ev.target.value.trim() !== e.name && renameEdit(e.id, ev.target.value)}
                  onKeyDown={(ev) => ev.key === "Enter" && ev.currentTarget.blur()}
                  className="w-full rounded-md bg-transparent px-1 text-[13.5px] font-bold text-ink focus:bg-white focus:outline-none"
                  aria-label="Edit name"
                />
                <div className="px-1 font-mono text-[10.5px] text-ink-muted">
                  {formatClock(e.dur)} · {formatBytes(e.bytes)}
                  {inUse.has(e.id) ? " · in use" : ""}
                </div>
              </div>
              {confirm === e.id ? (
                <button
                  type="button"
                  className="btn-ghost bg-sunset-100 px-2.5 text-[12px] text-sunset-700"
                  onClick={() => {
                    setConfirm(null);
                    void deleteEdit(e.id);
                  }}
                >
                  Delete?
                </button>
              ) : (
                <button type="button" className="btn-icon h-8 w-8 text-ink-muted" onClick={() => setConfirm(e.id)} aria-label={`Delete ${e.name}`}>
                  <TrashIcon width={15} height={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {preview && <EditPlayer editId={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}

function fmtWhen(ts?: number): string {
  if (!ts) return "never";
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className={cn("tap relative h-8 w-14 shrink-0 rounded-full transition-colors", on ? "bg-teal-500" : "bg-sand-300")}>
      <span className={cn("absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all", on ? "left-7" : "left-1")} />
    </button>
  );
}

function SoundPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const current = soundById(value);
  return (
    <span className="flex items-center gap-1">
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          playSound(e.target.value);
        }}
        className="max-w-[11rem] rounded-lg border border-sand-200 bg-white px-2 py-1 text-sm font-bold text-ink"
        aria-label="Sound"
      >
        {SOUNDS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.emoji} {s.name} · {s.dur}s
          </option>
        ))}
      </select>
      <button type="button" className="btn-icon h-8 w-8 text-base" onClick={() => playSound(value)} aria-label={`Play ${current.name}`} title="Play">
        ▶
      </button>
      <button
        type="button"
        className="btn-icon h-8 w-8 text-base"
        onClick={() => {
          const next = randomSound(value);
          onChange(next);
          playSound(next);
        }}
        aria-label="Random sound"
        title="Surprise me"
      >
        🎲
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
