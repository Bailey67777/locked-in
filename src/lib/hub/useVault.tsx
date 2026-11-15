"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useHub, HUB_PATH } from "./store";
import { normalizeVault } from "./model";
import type { PhotoMeta, Vault } from "./types";
import { WrongPasscode, createVault, forgetKey, openVault, rememberKey, rememberedKey, rewrapVault } from "./vault";
import { flushPhotos, forgetUnlisted, loadPhoto } from "./photos";
import { DB_URL, canUpload } from "../media";

/**
 * The lock on the progress photos, as the screens see it.
 *   "checking": still finding out · "none": no passcode has ever been set · "locked": set, but not typed in on this
 *   device yet · "open": this device can show and add photos.
 */
export type VaultState = "checking" | "none" | "locked" | "open";

type Ctx = {
  state: VaultState;
  key: CryptoKey | null;
  /** First time ever: choose the passcode. */
  create: (passcode: string) => Promise<void>;
  /** On another device: type the passcode once. Rejects with a message to show. */
  unlock: (passcode: string) => Promise<void>;
  /** A new passcode for the same photos (this device must already be open). */
  change: (passcode: string) => Promise<void>;
  /** Forget the key on this device; the passcode is needed again. */
  lock: () => Promise<void>;
};

const VaultContext = createContext<Ctx | null>(null);

const VAULT_URL = () => `${DB_URL}/${HUB_PATH}/vault.json`;

/**
 * Put the vault record in the cloud, but only if what is there is still what this device last saw (`etag`; a
 * vault that doesn't exist yet has the fixed tag "null_etag"). The database refuses otherwise. This goes straight
 * to the cloud, never through the offline queue: a vault record replayed hours later could replace the one another
 * device made in the meantime, and every photo locked with that one would be unreadable.
 */
async function putVault(vault: Vault, etag: string): Promise<"saved" | "changed" | "offline"> {
  try {
    const res = await fetch(VAULT_URL(), { method: "PUT", headers: { "Content-Type": "application/json", "if-match": etag }, body: JSON.stringify(vault) });
    if (res.status === 412) return "changed";
    return res.ok ? "saved" : "offline";
  } catch {
    return "offline";
  }
}

/** The vault as the cloud has it right now, with the tag that says which version that is. */
async function cloudVault(): Promise<{ vault: Vault | null; etag: string } | null> {
  try {
    const res = await fetch(VAULT_URL(), { cache: "no-store", headers: { "X-Firebase-ETag": "true" } });
    const etag = res.headers.get("ETag");
    if (!res.ok || !etag) return null;
    return { vault: normalizeVault(await res.json()), etag };
  } catch {
    return null;
  }
}

// Decrypted pictures stay in memory only, as object URLs: the newest hundred or so, the rest are let go.
const urls = new Map<string, string>();
const MAX_URLS = 120;

function keepUrl(id: string, url: string) {
  urls.set(id, url);
  if (urls.size <= MAX_URLS) return;
  const oldest = urls.keys().next().value;
  if (oldest === undefined) return;
  URL.revokeObjectURL(urls.get(oldest)!);
  urls.delete(oldest);
}

/** Let go of every decrypted picture (the device was locked). */
function dropUrls() {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { data, fresh, online, write, adopt } = useHub();
  const vault = data.vault;
  const salt = vault?.salt ?? null;
  // The key this device holds, and which vault (by salt) it belongs to.
  const [held, setHeld] = useState<{ salt: string | null; key: CryptoKey | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!vault) return;
    rememberedKey(vault)
      .catch(() => null)
      .then((key) => {
        if (!cancelled) setHeld((h) => (h && h.salt === vault.salt && h.key ? h : { salt: vault.salt, key }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the vault itself changes
  }, [salt]);

  const key = held && held.salt === salt ? held.key : null;
  const state: VaultState = !vault ? (fresh ? "none" : "checking") : !held || held.salt !== salt ? "checking" : key ? "open" : "locked";

  // Photos taken offline go up (and deletions made offline go through) when the app opens and whenever the
  // connection comes back.
  useEffect(() => {
    if (state !== "open" || !online) return;
    const id = window.setTimeout(() => void flushPhotos().catch(() => undefined), 1500);
    return () => window.clearTimeout(id);
  }, [state, online]);

  // Once per launch, when the cloud's list of photos is in: let go of copies of photos deleted on another device.
  const swept = useRef(false);
  const photos = data.photos;
  useEffect(() => {
    if (swept.current || !fresh || !online) return;
    swept.current = true;
    const listed = new Set<string>();
    for (const day of Object.values(photos)) for (const meta of Object.values(day)) if (meta) listed.add(meta.id);
    void forgetUnlisted(listed);
  }, [fresh, online, photos]);

  const create = useCallback(
    async (passcode: string) => {
      const made = await createVault(passcode);
      if (canUpload()) {
        const result = await putVault(made.vault, "null_etag");
        if (result === "offline") throw new Error("You need to be online to set this up.");
        if (result === "changed") throw new Error("A passcode is already set. Close this and unlock instead.");
        adopt("vault", made.vault);
      } else {
        write("vault", made.vault); // no cloud: this device is the only copy
      }
      await rememberKey(made.vault, made.key);
      setHeld({ salt: made.vault.salt, key: made.key });
    },
    [adopt, write],
  );

  const unlock = useCallback(
    async (passcode: string) => {
      if (!vault) throw new Error("No passcode has been set yet.");
      try {
        const k = await openVault(vault, passcode);
        await rememberKey(vault, k).catch(() => undefined);
        setHeld({ salt: vault.salt, key: k });
      } catch (e) {
        throw new Error(e instanceof WrongPasscode ? "Wrong passcode." : "Couldn't unlock on this device.");
      }
    },
    [vault],
  );

  const change = useCallback(
    async (passcode: string) => {
      if (!key) throw new Error("Unlock first.");
      const next = await rewrapVault(key, passcode);
      if (canUpload()) {
        const now = await cloudVault();
        if (!now) throw new Error("You need to be online to change it.");
        if (now.vault?.salt !== salt) throw new Error("It was just changed on another device. Unlock again first.");
        const result = await putVault(next, now.etag);
        if (result === "offline") throw new Error("You need to be online to change it.");
        if (result === "changed") throw new Error("It was just changed on another device. Unlock again first.");
        adopt("vault", next);
      } else {
        write("vault", next);
      }
      await rememberKey(next, key);
      setHeld({ salt: next.salt, key });
    },
    [key, salt, adopt, write],
  );

  const lock = useCallback(async () => {
    await forgetKey().catch(() => undefined);
    dropUrls();
    setHeld({ salt, key: null });
  }, [salt]);

  const value = useMemo<Ctx>(() => ({ state, key, create, unlock, change, lock }), [state, key, create, unlock, change, lock]);
  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): Ctx {
  const v = useContext(VaultContext);
  if (!v) throw new Error("useVault outside VaultProvider");
  return v;
}

/* ---------- showing a photo ---------- */

/** A photo ready to put in an <img>: its URL once it's decrypted, or why it can't be shown. */
export function usePhotoUrl(meta: PhotoMeta | undefined, size: "thumb" | "full"): { url: string | null; error: string | null } {
  const { key } = useVault();
  const id = meta ? `${meta.id}:${size}` : "";
  const [got, setGot] = useState<{ id: string; url: string | null; error: string | null }>({ id: "", url: null, error: null });

  useEffect(() => {
    if (!meta || !key || urls.has(id)) return;
    let cancelled = false;
    let tries = 0;
    let timer = 0;
    const attempt = () => {
      loadPhoto(key, meta, size)
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          keepUrl(id, url);
          if (!cancelled) setGot({ id, url, error: null });
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setGot({ id, url: null, error: e instanceof Error ? e.message : "Couldn't load this photo." });
          // Probably still on its way up from another device, or the connection dropped: look again shortly.
          if (tries++ < 6) timer = window.setTimeout(attempt, 4000 + tries * 3000);
        });
    };
    attempt();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the id says everything about which photo this is
  }, [id, key]);

  // No key, no picture: a locked device shows nothing, even if it was looking at the photo a moment ago.
  if (!meta || !key) return { url: null, error: null };
  const ready = urls.get(id);
  if (ready) return { url: ready, error: null };
  return got.id === id ? { url: got.url, error: got.error } : { url: null, error: null };
}
