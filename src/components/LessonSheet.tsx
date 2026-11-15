"use client";

import { useEffect, useRef, useState } from "react";
import { useHub } from "@/lib/hub/store";
import { safeKey } from "@/lib/hub/model";
import { SUBJECT_META } from "@/lib/hub/subjects";
import type { DayLesson, LessonLog } from "@/lib/hub/types";
import { cn } from "@/lib/cn";
import Sheet from "./Sheet";
import ClaudeNotes from "./ClaudeNotes";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const FEELINGS: { v: 1 | 2 | 3; label: string }[] = [
  { v: 1, label: "Shaky" },
  { v: 2, label: "Okay" },
  { v: 3, label: "Solid" },
];

const join = (a: string, b: string) => (b ? `${a}${a && !/\s$/.test(a) ? " " : ""}${b}` : a);

/**
 * One lesson: tap the button and say what you did; it's written down as you talk (and you can type or fix it).
 * It saves itself, and Claude reads it from here.
 */
export default function LessonSheet({ date, lesson, onClose }: { date: string; lesson: DayLesson; onClose: () => void }) {
  const { data, write } = useHub();
  const saved = data.days[date]?.logs[safeKey(lesson.key)];
  const [text, setText] = useState(saved?.text ?? "");
  const [interim, setInterim] = useState("");
  const [conf, setConf] = useState<LessonLog["conf"]>(saved?.conf);
  const [listening, setListening] = useState(false);
  // Some browsers have the feature but refuse it (an iPhone home-screen app, for one): then the keyboard's own mic does the job.
  const [canDictate, setCanDictate] = useState(() => recognitionCtor() !== null);
  const rec = useRef<Recognition | null>(null);
  const timer = useRef<number | null>(null);
  const latest = useRef({ text, conf });
  const area = useRef<HTMLTextAreaElement>(null);
  const meta = SUBJECT_META[lesson.subject];
  const note = data.days[date]?.claude?.subjects[lesson.subject];

  const save = (t: string, c: LessonLog["conf"]) => {
    const path = `days/${date}/logs/${safeKey(lesson.key)}`;
    if (!t.trim() && !c) write(path, null);
    else write(path, { subject: lesson.subject, text: t, at: Date.now(), ...(c ? { conf: c } : {}) });
  };

  const queue = (t: string, c: LessonLog["conf"]) => {
    latest.current = { text: t, conf: c };
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      save(t, c);
    }, 700);
  };

  const close = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
      save(latest.current.text, latest.current.conf);
    }
    rec.current?.stop();
    onClose();
  };

  useEffect(
    () => () => {
      rec.current?.stop();
    },
    [],
  );

  // The box grows with what's been said.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 132), window.innerHeight * 0.42)}px`;
  }, [text, interim]);

  const dictate = () => {
    if (listening) return rec.current?.stop();
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-GB";
    r.continuous = true;
    r.interimResults = true;
    const startText = latest.current.text;
    let heard = "";
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const said = e.results[i][0].transcript.trim();
        if (e.results[i].isFinal) heard = join(heard, said);
        else live = join(live, said);
      }
      const next = join(startText, heard);
      setText(next);
      setInterim(live);
      queue(next, latest.current.conf);
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
    };
    r.onerror = (e) => {
      setListening(false);
      setInterim("");
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        setCanDictate(false);
        area.current?.focus();
      }
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const time = lesson.start ? `${lesson.start}${lesson.end && lesson.end !== lesson.start ? `–${lesson.end}` : ""}` : meta.board;

  return (
    <Sheet label={time} accent={meta.color} onClose={close}>
      <h2 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.035em]">{meta.name}</h2>

      <textarea
        ref={area}
        value={listening ? join(text, interim) : text}
        readOnly={listening}
        onChange={(e) => {
          setText(e.target.value);
          queue(e.target.value, conf);
        }}
        placeholder="What did you do?"
        className="mt-4 w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3.5 text-[16px] leading-relaxed text-ink placeholder:text-faint focus:border-muted focus:outline-none"
        style={{ minHeight: 132 }}
        autoFocus={!canDictate && !saved?.text}
      />

      {canDictate && (
        <div className="mt-4 flex flex-col items-center">
          <button type="button" onClick={dictate} className="tap flex h-[68px] w-[68px] items-center justify-center rounded-full border-[1.5px] border-ink" aria-label={listening ? "Stop" : "Talk"} aria-pressed={listening}>
            <span className={cn("bg-ink transition-all duration-200", listening ? "breathe h-6 w-6 rounded-[5px]" : "h-[52px] w-[52px] rounded-full")} />
          </button>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1">
        {FEELINGS.map((f) => (
          <button
            key={f.v}
            type="button"
            aria-pressed={conf === f.v}
            onClick={() => {
              const next = conf === f.v ? undefined : f.v;
              setConf(next);
              queue(latest.current.text, next);
            }}
            className={cn("h-10 rounded-xl text-[14px] transition-colors", conf === f.v ? "bg-ink text-bg" : "text-ink-2")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {note && <ClaudeNotes note={note} className="mt-6" />}
    </Sheet>
  );
}
