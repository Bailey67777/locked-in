/**
 * The keys that lock the progress photos.
 *
 * One random 256-bit AES-GCM "photo key" encrypts every photo. The database only ever sees it wrapped (encrypted)
 * by a second key, and that key takes two things to make: the six-digit code, and a value ("pepper") that only the
 * app's own server can work out, a few times an hour at most. A six-digit code alone could be guessed by a machine
 * trying all million of them against a copy of the database; with the pepper, every guess has to go through the
 * server, which stops answering long before that. The code never leaves the device it is typed on. Each device then
 * keeps the unwrapped photo key in IndexedDB, so the code is typed once per device rather than every time.
 */
import { b64ToBytes, bytesToB64 } from "../media";
import type { Sealed, Vault } from "./types";

/** Slow on purpose (a fraction of a second on a phone). */
const ITERATIONS = 600_000;
const IV_BYTES = 12;
const AES = { name: "AES-GCM", length: 256 } as const;

const DB_NAME = "hugo-vault";
const STORE = "keys";
/** There is only ever one photo key, so one fixed slot. */
const SLOT = "photos";

/**
 * Asks the server for the pepper that goes with one guess. `proof` is a fingerprint of the code as typed (never the
 * code itself); a different guess gets a different, useless pepper. Rejects when the server can't be reached or has
 * had too many tries.
 */
export type Pepper = (salt: string, proof: string) => Promise<Uint8Array<ArrayBuffer>>;

export class WrongPasscode extends Error {
  constructor() {
    super("That code isn't right.");
    this.name = "WrongPasscode";
  }
}

/** Looked up when used, never at import: this file is also loaded while the page is rendered on the server. */
function subtle(): SubtleCrypto {
  const s = typeof crypto === "undefined" ? undefined : crypto.subtle;
  if (!s) throw new Error("This browser can't lock photos here (it needs an https page).");
  return s;
}

const random = (bytes: number) => crypto.getRandomValues(new Uint8Array(bytes));
const text = (s: string) => new TextEncoder().encode(s);

async function sha256(...parts: Uint8Array[]): Promise<Uint8Array<ArrayBuffer>> {
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return new Uint8Array(await subtle().digest("SHA-256", all));
}

/** The key that wraps the photo key: made from the code (stretched with PBKDF2) and the server's pepper for it. */
async function wrappingKey(code: string, salt: Uint8Array<ArrayBuffer>, iterations: number, pepper: Pepper): Promise<CryptoKey> {
  const material = await subtle().importKey("raw", text(code.normalize("NFKC").trim()), "PBKDF2", false, ["deriveBits"]);
  const stretched = new Uint8Array(await subtle().deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, material, 256));
  const proof = bytesToB64(await sha256(text("hugo-vault-proof:"), stretched));
  const extra = await pepper(bytesToB64(salt), proof);
  return subtle().importKey("raw", await sha256(text("hugo-vault-key:"), stretched, extra), AES, false, ["encrypt", "decrypt"]);
}

async function wrap(key: CryptoKey, code: string, pepper: Pepper): Promise<Vault> {
  const salt = random(16);
  const iv = random(IV_BYTES);
  const raw = await subtle().exportKey("raw", key);
  const ct = await subtle().encrypt({ name: "AES-GCM", iv }, await wrappingKey(code, salt, ITERATIONS, pepper), raw);
  const wrapped: Sealed = { iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) };
  return { v: 2, salt: bytesToB64(salt), iterations: ITERATIONS, wrapped, at: Date.now() };
}

/** Make the photo key and the record to store in the database. Done once, on the first device. */
export async function createVault(code: string, pepper: Pepper): Promise<{ vault: Vault; key: CryptoKey }> {
  // Extractable, so a change of code can wrap the same key again instead of re-encrypting every photo.
  const key = await subtle().generateKey(AES, true, ["encrypt", "decrypt"]);
  return { vault: await wrap(key, code, pepper), key };
}

/** Unlock with the code. Throws WrongPasscode when it doesn't fit; whatever `pepper` rejects with passes through. */
export async function openVault(vault: Vault, code: string, pepper: Pepper): Promise<CryptoKey> {
  const unwrapper = await wrappingKey(code, b64ToBytes(vault.salt), vault.iterations, pepper);
  let raw: ArrayBuffer;
  try {
    raw = await subtle().decrypt({ name: "AES-GCM", iv: b64ToBytes(vault.wrapped.iv) }, unwrapper, b64ToBytes(vault.wrapped.ct));
  } catch {
    // AES-GCM checks itself: the only way this fails on an intact record is a different code.
    throw new WrongPasscode();
  }
  return subtle().importKey("raw", raw, AES, true, ["encrypt", "decrypt"]);
}

/**
 * The record for a new code, around the same photo key. The salt is new too, so every device (this one included)
 * stops recognising its remembered key until `rememberKey` is called with the new record.
 */
export function rewrapVault(key: CryptoKey, code: string, pepper: Pepper): Promise<Vault> {
  return wrap(key, code, pepper);
}

/* ---------- the key this device remembers ---------- */

type Remembered = { salt: string; key: CryptoKey };

/** Opened for each use and closed again: iOS drops connections that are held while the app sleeps. */
async function keyStore<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = run(t.objectStore(STORE));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Keep the unlocked key on this device, tied to this vault. The CryptoKey object itself is stored (IndexedDB can
 * hold one), not its bytes. If the device won't store it (private browsing) the code is simply asked again next time.
 */
export async function rememberKey(vault: Vault, key: CryptoKey): Promise<void> {
  try {
    await keyStore("readwrite", (s) => s.put({ salt: vault.salt, key } satisfies Remembered, SLOT));
  } catch {
    /* private mode: stays unlocked only until the app closes */
  }
}

/** The key this device remembers, or null if it has none or it belongs to a vault that has since been replaced. */
export async function rememberedKey(vault: Vault): Promise<CryptoKey | null> {
  try {
    const hit = (await keyStore<Remembered | undefined>("readonly", (s) => s.get(SLOT))) ?? null;
    return hit && hit.salt === vault.salt ? hit.key : null;
  } catch {
    return null;
  }
}

/** Lock this device: the code is needed again. Photos already on the device stay, still encrypted. */
export async function forgetKey(): Promise<void> {
  try {
    await keyStore("readwrite", (s) => s.delete(SLOT));
  } catch {
    /* nothing was stored */
  }
}

/* ---------- locking and unlocking data ---------- */

/** Encrypt. The result is base64 of a fresh 12-byte IV followed by the ciphertext, ready to store as one string. */
export async function seal(key: CryptoKey, data: ArrayBuffer): Promise<string> {
  const iv = random(IV_BYTES);
  const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv }, key, data));
  const out = new Uint8Array(IV_BYTES + ct.length);
  out.set(iv);
  out.set(ct, IV_BYTES);
  return bytesToB64(out);
}

/** Decrypt what `seal` made. Throws if it was sealed with another key or a single bit has changed. */
export async function unseal(key: CryptoKey, sealed: string): Promise<ArrayBuffer> {
  const bytes = b64ToBytes(sealed);
  return subtle().decrypt({ name: "AES-GCM", iv: bytes.subarray(0, IV_BYTES) }, key, bytes.subarray(IV_BYTES));
}
