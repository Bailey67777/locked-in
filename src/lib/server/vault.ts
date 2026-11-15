import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * The server's half of the photo lock.
 *
 * The photos are locked with a six-digit code. On its own that would be weak: anyone holding a copy of the database
 * could try all million codes on their own machine. So the key that wraps the photo key is made from the code AND a
 * "pepper" that only this server can compute, because it needs a secret that exists nowhere else. Each guess needs
 * its own pepper, and this hands out only a few an hour, so guessing the code would take decades.
 *
 * The server never sees the code or the photo key: it gets a fingerprint of the guess and returns the pepper for it.
 * It cannot tell a right guess from a wrong one, so every request counts as a try.
 *
 * The secret used here is derived from the server's secret (VAULT_SECRET if set, else CLAUDE_API_SECRET) and is
 * never sent anywhere. Nothing the server hands out (the connector link's token, a pepper) can be turned back into
 * it. Changing the underlying secret makes the existing code stop working on devices that aren't unlocked yet:
 * before ever changing CLAUDE_API_SECRET, set VAULT_SECRET to its old value.
 *
 * One limit to know: the tries are counted for everyone together, so someone hammering this could use them up and
 * keep a new device from unlocking that day. Photos already unlocked on a device are unaffected.
 */

const DB_URL = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "").replace(/\/$/, "");
const DATA_KEY = process.env.NEXT_PUBLIC_DATA_KEY || "default";

/** How many tries are answered: per hour, and per day. A million codes at this rate is about ninety years. */
export const PER_HOUR = 10;
export const PER_DAY = 30;
const HOUR = 3600_000;
const DAY = 24 * HOUR;

export type PepperResult = { ok: true; pepper: string } | { ok: false; status: 404 | 429 | 503; retryIn?: number };

function secret(): string | null {
  const s = process.env.VAULT_SECRET || process.env.CLAUDE_API_SECRET;
  return s && s.length >= 16 ? createHmac("sha256", s).update("hugo-vault-secret:v1").digest("hex") : null;
}

const sameText = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
const B64 = /^[A-Za-z0-9+/]{16,64}={0,2}$/;

/**
 * Where the list of recent tries is kept: a place in the database whose name comes from the secret, so nobody
 * holding only the app's public data key can find it and wipe the count.
 */
function triesUrl(s: string): string {
  const where = createHmac("sha256", s).update(`vault-tries:${DATA_KEY}`).digest("hex").slice(0, 40);
  return `${DB_URL}/spaces/srv-${where}/vault-tries.json`;
}

/** Note one more try, unless the limit has been reached. Returns how long to wait when it has. Fails closed. */
async function countTry(s: string, now: number): Promise<{ allowed: true } | { allowed: false; retryIn: number }> {
  const url = triesUrl(s);
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { cache: "no-store", headers: { "X-Firebase-ETag": "true" }, signal: AbortSignal.timeout(8000) });
    const etag = res.headers.get("ETag");
    if (!res.ok || !etag) throw new Error("tries unavailable");
    const raw = (await res.json()) as unknown;
    const tries = (Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : []).filter((t): t is number => typeof t === "number" && t > now - DAY && t <= now + 60_000).sort((a, b) => a - b);
    const lastHour = tries.filter((t) => t > now - HOUR);
    if (lastHour.length >= PER_HOUR) return { allowed: false, retryIn: lastHour[0] + HOUR - now };
    if (tries.length >= PER_DAY) return { allowed: false, retryIn: tries[0] + DAY - now };
    // Only if nobody else has written since the read: two tries at the same moment can't both slip under the limit.
    const put = await fetch(url, { method: "PUT", cache: "no-store", headers: { "Content-Type": "application/json", "if-match": etag }, body: JSON.stringify([...tries, now]), signal: AbortSignal.timeout(8000) });
    if (put.ok) return { allowed: true };
    if (put.status !== 412) throw new Error("tries unavailable");
  }
  return { allowed: false, retryIn: 60_000 };
}

/** The pepper for one guess, if the request comes from the app and there are tries left. */
export async function pepperFor(input: { key?: unknown; salt?: unknown; proof?: unknown }, now = Date.now()): Promise<PepperResult> {
  const { key, salt, proof } = input;
  if (typeof key !== "string" || !sameText(key, DATA_KEY)) return { ok: false, status: 404 };
  if (typeof salt !== "string" || typeof proof !== "string" || !B64.test(salt) || !B64.test(proof)) return { ok: false, status: 404 };
  const s = secret();
  if (!s || !DB_URL) return { ok: false, status: 503 };
  let counted: Awaited<ReturnType<typeof countTry>>;
  try {
    counted = await countTry(s, now);
  } catch {
    return { ok: false, status: 503 };
  }
  if (!counted.allowed) return { ok: false, status: 429, retryIn: counted.retryIn };
  return { ok: true, pepper: createHmac("sha256", s).update(`vault-pepper:${DATA_KEY}:${salt}:${proof}`).digest("base64") };
}
