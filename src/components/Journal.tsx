"use client";

import { useEffect, useRef, useState } from "react";

type Props = { value: string; onSave: (text: string) => void };

/** Autosaving free-text box. Remote changes only replace the text when you're not mid-edit. */
export default function Journal({ value, onSave }: Props) {
  const [text, setText] = useState(value);
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);
  const [status, setStatus] = useState<"idle" | "typing" | "saved">("idle");

  useEffect(() => {
    if (!dirty.current) setText(value);
  }, [value]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const change = (v: string) => {
    setText(v);
    dirty.current = true;
    setStatus("typing");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      onSave(v);
      dirty.current = false;
      setStatus("saved");
    }, 600);
  };

  const flush = () => {
    if (!dirty.current) return;
    if (timer.current) window.clearTimeout(timer.current);
    onSave(text);
    dirty.current = false;
    setStatus("saved");
  };

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => change(e.target.value)}
        onBlur={flush}
        rows={4}
        placeholder="One honest paragraph. What went well, what you'd change, what tomorrow's block is."
        className="field min-h-28 resize-y leading-relaxed"
      />
      <div className="mt-1 h-4 text-right text-[11px] font-bold text-ink-muted">
        {status === "typing" ? "Saving…" : status === "saved" ? "Saved" : ""}
      </div>
    </div>
  );
}
