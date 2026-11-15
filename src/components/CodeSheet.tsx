"use client";

import { useEffect, useRef, useState } from "react";
import { useVault } from "@/lib/hub/useVault";
import { cn } from "@/lib/cn";
import Sheet from "./Sheet";

const LENGTH = 6;

const COPY = {
  create: { title: "Set a code", button: "Set code" },
  unlock: { title: "Enter your code", button: "" },
  change: { title: "New code", button: "Change code" },
} as const;

/** The six-digit photo code: choose it (first time), type it (a new device), or change it. */
export default function CodeSheet({ mode, onClose, onDone }: { mode: keyof typeof COPY; onClose: () => void; onDone?: () => void }) {
  const vault = useVault();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[mode];
  const full = code.length === LENGTH;

  const submit = async (value: string) => {
    if (value.length !== LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "create") await vault.create(value);
      else if (mode === "unlock") await vault.unlock(value);
      else await vault.change(value);
      onDone?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
      setCode("");
      setBusy(false);
    }
  };

  // Typing the sixth digit is enough to unlock: there's nothing to check by eye when the digits are hidden.
  const latest = useRef(submit);
  useEffect(() => {
    latest.current = submit;
  });
  useEffect(() => {
    if (mode === "unlock" && code.length === LENGTH) void latest.current(code);
  }, [mode, code]);

  return (
    <Sheet label="Photos" onClose={onClose}>
      <h2 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.035em]">{copy.title}</h2>
      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(code);
        }}
      >
        <label className="relative block">
          <div className="grid grid-cols-6 gap-2" aria-hidden="true">
            {Array.from({ length: LENGTH }, (_, i) => (
              <div key={i} className={cn("flex h-16 items-center justify-center rounded-2xl bg-surface text-[26px] font-bold tabular-nums transition-shadow", i === code.length && !busy ? "shadow-[inset_0_0_0_1.5px_var(--ink)]" : "shadow-[inset_0_0_0_1px_var(--line)]")}>
                {code[i] ? (mode === "unlock" ? <span className="h-2.5 w-2.5 rounded-full bg-ink" /> : code[i]) : null}
              </div>
            ))}
          </div>
          {/* The real field sits invisibly over the six boxes, so a tap anywhere on them brings up the number pad. */}
          <input
            value={code}
            onChange={(e) => {
              if (busy) return;
              setCode(e.target.value.replace(/\D/g, "").slice(0, LENGTH));
              setError(null);
            }}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            autoFocus
            // Not disabled while it checks: a disabled field drops the keyboard and can't be focused again by code.
            readOnly={busy}
            className="absolute inset-0 h-full w-full cursor-default text-[16px] opacity-0"
            aria-label="Six-digit code"
          />
        </label>
        <div className="mt-3 min-h-[18px] text-[13px] text-ink-2">{busy ? "…" : error}</div>
        {copy.button && (
          <button type="submit" className="btn mt-2 h-14 w-full text-[16px]" disabled={!full || busy}>
            {copy.button}
          </button>
        )}
      </form>
    </Sheet>
  );
}
