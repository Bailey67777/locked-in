"use client";

import { useEffect, useRef, useState } from "react";

type Props = { value: string; onSave: (v: string) => void; placeholder?: string; className?: string; ariaLabel?: string; maxLength?: number };

/** A one-line input that saves shortly after you stop typing (so every keystroke isn't a database write). */
export default function DebouncedInput({ value, onSave, placeholder, className, ariaLabel, maxLength = 140 }: Props) {
  const [text, setText] = useState(value);
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!dirty.current) setText(value);
  }, [value]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const commit = (v: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    dirty.current = false;
    onSave(v.trim());
  };

  return (
    <input
      value={text}
      maxLength={maxLength}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        dirty.current = true;
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => commit(v), 700);
      }}
      onBlur={() => dirty.current && commit(text)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className ?? "field"}
      autoComplete="off"
    />
  );
}
