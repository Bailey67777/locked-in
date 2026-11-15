"use client";

import { useState } from "react";
import { useVault } from "@/lib/hub/useVault";
import Sheet from "./Sheet";

const COPY = {
  create: { title: "Lock your photos", line: "One passcode, 8 characters or more. You type it once on each device, and nobody without it can see them.", button: "Set passcode" },
  unlock: { title: "Unlock photos", line: "", button: "Unlock" },
  change: { title: "New passcode", line: "8 characters or more. Your other devices will ask for it once.", button: "Change passcode" },
} as const;

/** Choose the photo passcode (first time), type it (a new device), or change it. */
export default function PasscodeSheet({ mode, onClose, onDone }: { mode: keyof typeof COPY; onClose: () => void; onDone?: () => void }) {
  const vault = useVault();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[mode];
  // The scrambled photos can be fetched by anyone who finds the app's address, so the passcode is the whole lock:
  // a short one could be guessed by a machine trying millions.
  const ok = mode === "unlock" ? value.length > 0 : value.trim().length >= 8;

  const submit = async () => {
    if (!ok || busy) return;
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
      setBusy(false);
    }
  };

  return (
    <Sheet label="Photos" onClose={onClose}>
      <h2 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.035em]">{copy.title}</h2>
      {copy.line && <p className="mt-2 text-[14px] leading-snug text-muted">{copy.line}</p>}
      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          type={mode === "unlock" ? "password" : "text"}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          autoFocus
          autoComplete={mode === "unlock" ? "current-password" : "new-password"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Passcode"
          className="field h-14 text-[17px]"
          aria-label="Passcode"
        />
        <div className="mt-2 min-h-[18px] text-[13px] text-ink-2">{error}</div>
        <button type="submit" className="btn mt-2 h-14 w-full text-[16px]" disabled={!ok || busy}>
          {busy ? "…" : copy.button}
        </button>
      </form>
    </Sheet>
  );
}
