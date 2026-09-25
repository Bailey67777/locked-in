"use client";

import { useEffect, useRef, useState } from "react";
import { askBrowserPermission, browserNotificationsSupported, buildIcs, downloadText, randomTopic, sendTestPush } from "@/lib/reminders";
import { useStore } from "@/lib/store";
import { cloudConfigured } from "@/lib/firebase";
import { uid } from "@/lib/model";
import { AUTO_EMOJIS, DEFAULT_COLOR, EMOJI_SUGGESTIONS, HABIT_COLORS } from "@/lib/defaults";
import { SOUNDS, pickSoundForHabit, playSound, randomSound, soundById } from "@/lib/sounds";
import { cn } from "@/lib/cn";
import type { HabitDef } from "@/lib/types";
import { ChevronIcon, PlusIcon, TrashIcon } from "./Icons";

export default function SettingsView() {
  const { data, updateSettings, sync, today, journalState, journalBusy, unlockJournal, lockJournal, changePassphrase } = useStore();
  const [jp, setJp] = useState({ current: "", next: "", confirm: "" });
  const [jpMsg, setJpMsg] = useState<{ ok: boolean; text: string } | null>(null);
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
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(h.keystone)}
                    onClick={() => patch(h.id, { keystone: !h.keystone })}
                    title="If a must-do habit is missed, the submitted day drops straight to the bottom tier"
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

      <section className="card p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-ink">Sounds</h2>
            <p className="text-sm font-semibold text-ink-muted">Fifty long, daft noises, all matched to the same loudness and boosted. New habits get a random one that loosely fits their name. Silent mode on your phone still mutes them.</p>
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
            <span className="text-sm font-bold text-ink">Every habit</span>
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
        <h2 className="text-lg font-extrabold text-ink">First A-level exam</h2>
        <p className="text-sm font-semibold text-ink-muted">Drives the countdown on Today and the end of the Study graph. Linear A-levels, so probably May 2028; set it once you know.</p>
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

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">Journal passphrase</h2>
        <p className="text-sm font-semibold text-ink-muted">Your personal journal is encrypted on your devices with this. Nobody can reset it, so keep it written down offline.</p>
        {journalState === "unavailable" && <p className="mt-2 text-sm font-bold text-sunset-600">This browser can&apos;t do the encryption.</p>}
        {journalState === "none" && <p className="mt-2 rounded-2xl bg-sand-50 px-3 py-2 text-sm font-semibold text-ink-soft">Not set yet. Create it in the Journal section on Today; your existing entries get encrypted at the same time.</p>}
        {journalState === "locked" && (
          <form
            className="mt-2 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setJpMsg(null);
              const ok = await unlockJournal(jp.current);
              setJpMsg(ok ? { ok: true, text: "Unlocked on this device." } : { ok: false, text: "Wrong passphrase." });
              if (ok) setJp({ current: "", next: "", confirm: "" });
            }}
          >
            <input type="password" className="field" placeholder="Passphrase to unlock" value={jp.current} onChange={(e) => setJp({ ...jp, current: e.target.value })} autoComplete="current-password" aria-label="Passphrase" />
            <button type="submit" className="btn-primary px-4" disabled={journalBusy || !jp.current}>
              Unlock
            </button>
          </form>
        )}
        {journalState === "unlocked" && (
          <div className="mt-2 flex flex-col gap-3">
            <button type="button" className="btn-ghost self-start bg-sand-50" onClick={() => lockJournal()}>
              🔒 Lock journal now
            </button>
            <form
              className="flex flex-col gap-2 rounded-2xl bg-sand-50 p-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setJpMsg(null);
                if (jp.next.length < 8) return setJpMsg({ ok: false, text: "Use at least 8 characters." });
                if (jp.next !== jp.confirm) return setJpMsg({ ok: false, text: "The new passphrases don't match." });
                try {
                  const n = await changePassphrase(jp.current, jp.next);
                  setJpMsg({ ok: true, text: `Passphrase changed. ${n} ${n === 1 ? "entry" : "entries"} re-encrypted.` });
                  setJp({ current: "", next: "", confirm: "" });
                } catch (err) {
                  setJpMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't change it; nothing was altered." });
                }
              }}
            >
              <div className="text-sm font-extrabold text-ink">Change passphrase</div>
              <input type="password" className="field" placeholder="Current passphrase" value={jp.current} onChange={(e) => setJp({ ...jp, current: e.target.value })} autoComplete="current-password" />
              <input type="password" className="field" placeholder="New passphrase (8+ characters)" value={jp.next} onChange={(e) => setJp({ ...jp, next: e.target.value })} autoComplete="new-password" />
              <input type="password" className="field" placeholder="New passphrase again" value={jp.confirm} onChange={(e) => setJp({ ...jp, confirm: e.target.value })} autoComplete="new-password" />
              <button type="submit" className="btn-primary" disabled={journalBusy || !jp.current || !jp.next || !jp.confirm}>
                {journalBusy ? "Re-encrypting…" : "Change passphrase"}
              </button>
            </form>
          </div>
        )}
        {jpMsg && <p className={cn("mt-2 text-sm font-bold", jpMsg.ok ? "text-teal-600" : "text-sunset-600")}>{jpMsg.text}</p>}
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">Claude sync</h2>
        <p className="text-sm font-semibold text-ink-muted">The nightly Claude task reads your academic journal and answers, then writes questions, marks and estimates back.</p>
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
        <p className="mt-2 text-[11px] font-semibold text-ink-muted">Setup lives in <code className="rounded bg-sand-100 px-1">docs/NIGHTLY_CLAUDE_TASK.md</code> in the repo. Your personal journal is never sent, not even encrypted.</p>
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">Reminders</h2>
        <p className="text-sm font-semibold text-ink-muted">
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

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">Submit-day videos</h2>
        <p className="mt-1 text-sm font-semibold text-ink-soft">
          Upload your MP4s to <code className="rounded bg-sand-100 px-1">public/media/</code> on GitHub with exactly these names. Any length.
        </p>
        <ul className="mt-2 flex flex-col gap-1 text-sm font-semibold text-ink-soft">
          <li>🎸 80–100% → <code className="rounded bg-sand-100 px-1">day-80-100.mp4</code></li>
          <li>😐 50–79% → <code className="rounded bg-sand-100 px-1">day-50-80.mp4</code></li>
          <li>😬 25–49% → <code className="rounded bg-sand-100 px-1">day-25-50.mp4</code> (optional: falls back to the one below)</li>
          <li>💀 0–24%, or a ⭐ must-do habit missed → <code className="rounded bg-sand-100 px-1">day-0-25.mp4</code></li>
        </ul>
        <p className="mt-2 text-xs font-semibold text-ink-muted">GitHub&apos;s website only accepts files up to 25 MB, so trim or compress long videos first.</p>
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
