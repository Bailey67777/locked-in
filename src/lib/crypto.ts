/**
 * End-to-end encryption for the personal journal, using the browser's Web Crypto API.
 *
 * - Key: PBKDF2-SHA256, 600,000 iterations, random 16-byte salt → AES-GCM 256, non-extractable.
 * - Each entry: fresh random 12-byte IV, AES-GCM. Stored as base64 { iv, ct }.
 * - Between sessions the derived CryptoKey (never the passphrase) can live in IndexedDB.
 *
 * Plaintext never leaves this device. Nothing here logs, and nothing here touches localStorage.
 */
import type { EncryptedText, JournalCrypto } from "./types";

export const PBKDF2_ITERATIONS = 600_000;
const VERIFY_PHRASE = "locked-in journal · this decrypts only with the right passphrase";
const DB_NAME = "locked-in-keys";
const STORE = "keys";
const KEY_ID = "journal";

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function cryptoAvailable(): boolean {
  return typeof crypto !== "undefined" && Boolean(crypto.subtle);
}

export function newSalt(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return toB64(salt);
}

export async function deriveKey(passphrase: string, saltB64: string, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: fromB64(saltB64), iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false, // never extractable
    ["encrypt", "decrypt"],
  );
}

export async function encryptText(key: CryptoKey, text: string): Promise<EncryptedText> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
  return { iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
}

/** Throws if the key is wrong or the data was tampered with. */
export async function decryptText(key: CryptoKey, data: EncryptedText): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(data.iv) }, key, fromB64(data.ct));
  return dec.decode(pt);
}

export async function makeCryptoParams(key: CryptoKey, salt: string): Promise<JournalCrypto> {
  return { v: 1, salt, iterations: PBKDF2_ITERATIONS, verifier: await encryptText(key, VERIFY_PHRASE), updatedAt: Date.now() };
}

export async function verifyKey(key: CryptoKey, params: JournalCrypto): Promise<boolean> {
  try {
    return (await decryptText(key, params.verifier)) === VERIFY_PHRASE;
  } catch {
    return false;
  }
}

/* ---------- remembering the key on this device (IndexedDB, non-extractable CryptoKey) ---------- */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function rememberKey(key: CryptoKey, salt: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ key, salt }, KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* private mode etc: the key just lives in memory for this session */
  }
}

export async function recallKey(): Promise<{ key: CryptoKey; salt: string } | null> {
  try {
    const db = await openDb();
    const result = await new Promise<{ key: CryptoKey; salt: string } | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY_ID);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result && result.key ? result : null;
  } catch {
    return null;
  }
}

export async function forgetKey(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
}
