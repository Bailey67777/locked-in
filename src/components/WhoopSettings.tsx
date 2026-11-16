"use client";

import { useState } from "react";
import { useHub } from "@/lib/hub/store";
import { whoopCall } from "@/lib/hub/whoop";

/**
 * Connecting the WHOOP. WHOOP only gives its numbers to an app registered in his own WHOOP account, so the first
 * time it asks for that app's two keys (kept on the server, never on the phone), then sends him to WHOOP to approve.
 */
export default function WhoopSettings() {
  const { data, adopt } = useHub();
  const on = data.settings.whoop;
  const [keys, setKeys] = useState(false);
  const [id, setId] = useState("");
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const connect = async (withKeys: boolean) => {
    setBusy(true);
    setStatus(null);
    try {
      const r = withKeys ? await whoopCall("keys", { clientId: id.trim(), clientSecret: secret.trim() }) : await whoopCall("start");
      if (r.url) return window.location.assign(r.url);
      if (r.code === "keys" && !withKeys) setKeys(true);
      else setStatus(r.error ?? "Couldn't reach WHOOP.");
    } catch {
      setStatus("You need to be online.");
    }
    setBusy(false);
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await whoopCall("disconnect");
      adopt("settings/whoop", null);
    } catch {
      setStatus("You need to be online.");
    }
    setBusy(false);
  };

  if (on) {
    return (
      <div className="flex h-14 items-center justify-between rounded-2xl bg-surface px-4">
        <span className="text-[16px] font-medium">Connected</span>
        <button type="button" onClick={() => void disconnect()} disabled={busy} className="-mr-2 h-10 px-2 text-[13.5px] text-muted disabled:opacity-40">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <>
      {keys ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void connect(true);
          }}
        >
          <input readOnly value={typeof window === "undefined" ? "" : `${window.location.origin}/api/whoop/callback`} onFocus={(e) => e.currentTarget.select()} className="field font-mono text-[12px]" aria-label="Redirect URL to give WHOOP" />
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="Client ID" autoComplete="off" autoCapitalize="off" spellCheck={false} className="field mt-2 font-mono text-[13px]" aria-label="WHOOP Client ID" />
          <input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Client Secret" type="password" autoComplete="off" className="field mt-2 font-mono text-[13px]" aria-label="WHOOP Client Secret" />
          <button type="submit" disabled={busy || !id.trim() || !secret.trim()} className="btn mt-3 w-full">
            Connect
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => void connect(false)} disabled={busy} className="tap flex h-14 w-full items-center justify-between rounded-2xl bg-surface px-4 text-left disabled:opacity-60">
          <span className="text-[16px] font-medium">Connect</span>
          <span className="text-[12.5px] text-muted">{busy ? "…" : ""}</span>
        </button>
      )}
      {status && <p className="mt-2 px-1 text-[12.5px] text-muted">{status}</p>}
    </>
  );
}
