/**
 * The keys that lock the progress photos.
 *
 * One random 256-bit AES-GCM "photo key" encrypts every photo. The database only ever sees it wrapped (encrypted)
 * by a second key made from the passcode with PBKDF2, so the path being guessed gives away nothing readable. The
 * passcode never leaves the device it is typed on. Each device then keeps the unwrapped photo key in IndexedDB, so
 * the passcode is typed once per device rather than every time the app opens.
 */
import { b64ToBytes, bytesToB64 } from "../media";
import type { Sealed, Vault } from "./types";

/** Slow on purpose (about half a second on a phone): it is what makes guessing a short passcode expensive. */
const ITERATIONS = 600_000;
const IV_BYTES = 12;
const AES = { name: "AES-GCM", length: 256 } as const;

const DB_NAME = "hugo-vault";
const STORE = "keys";
/** There is only ever one photo key, so one fixed slot. */
const SLOT = "photos";

export class WrongPasscode extends Error {
  constructor() {
    super("That passcode isn't right.");
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

/** The key made from the passcode. Only used to wrap and unwrap the photo key. */
async function passcodeKey(passcode: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  // NFKC so the same passcode typed on another keyboard (composed vs. combining accents) gives the same key. A stray
  // space at either end goes, since a keyboard adds one unasked; spaces inside are part of the passcode.
  const typed = new TextEncoder().encode(passcode.normalize("NFKC").trim());
  const material = await subtle().importKey("raw", typed, "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, material, AES, false, ["encrypt", "decrypt"]);
}

async function wrap(key: CryptoKey, passcode: string): Promise<Vault> {
  const salt = random(16);
  const iv = random(IV_BYTES);
  const raw = await subtle().exportKey("raw", key);
  const ct = await subtle().encrypt({ name: "AES-GCM", iv }, await passcodeKey(passcode, salt, ITERATIONS), raw);
  const wrapped: Sealed = { iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) };
  return { v: 1, salt: bytesToB64(salt), iterations: ITERATIONS, wrapped, at: Date.now() };
}

/** Make the photo key and the record to store in the database. Done once, on the first device. */
export async function createVault(passcode: string): Promise<{ vault: Vault; key: CryptoKey }> {
  // Extractable, so a passcode change can wrap the same key again instead of re-encrypting every photo.
  const key = await subtle().generateKey(AES, true, ["encrypt", "decrypt"]);
  return { vault: await wrap(key, passcode), key };
}

/** Unlock with the passcode. Throws WrongPasscode when it doesn't fit. */
export async function openVault(vault: Vault, passcode: string): Promise<CryptoKey> {
  const unwrapper = await passcodeKey(passcode, b64ToBytes(vault.salt), vault.iterations);
  let raw: ArrayBuffer;
  try {
    raw = await subtle().decrypt({ name: "AES-GCM", iv: b64ToBytes(vault.wrapped.iv) }, unwrapper, b64ToBytes(vault.wrapped.ct));
  } catch {
    // AES-GCM checks itself: the only way this fails on an intact record is a different passcode.
    throw new WrongPasscode();
  }
  return subtle().importKey("raw", raw, AES, true, ["encrypt", "decrypt"]);
}

/**
 * The record for a new passcode, around the same photo key. The salt is new too, so every device (this one
 * included) stops recognising its remembered key until `rememberKey` is called with the new record.
 */
export function rewrapVault(key: CryptoKey, passcode: string): Promise<Vault> {
  return wrap(key, passcode);
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
 * hold one), not its bytes. If the device won't store it (private browsing) the passcode is simply asked again
 * next time.
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

/** Lock this device: the passcode is needed again. Photos already on the device stay, still encrypted. */
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
