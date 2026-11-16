import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Whoop } from "@/lib/hub/types";

/**
 * The WHOOP connection: recovery, sleep and strain, read straight from WHOOP's own API and nowhere else.
 *
 * WHOOP hands its numbers only to an app registered with it, so there is one, in his own WHOOP account, and this
 * server holds its two keys and the tokens WHOOP gives when he approves it. They are kept in the database at a
 * place whose name comes from the server's secret, and locked with a key made from that secret, so neither the
 * app's public data key nor a copy of the database gives them away. The app itself only ever sees the numbers,
 * at spaces/<key>/hub/whoop/<date>.
 */

const DB_URL = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "").replace(/\/$/, "");
const DATA_KEY = process.env.NEXT_PUBLIC_DATA_KEY || "default";
const AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const API = "https://api.prod.whoop.com/developer/v2";
/** `offline` is what makes WHOOP give a token that can be renewed without asking him again. */
const SCOPE = "offline read:recovery read:sleep read:cycles";
const STATE_MS = 15 * 60_000;

type Stored = { clientId?: string; clientSecret?: string; refresh?: string; access?: string; expires?: number };

export class WhoopError extends Error {
  constructor(
    public code: "setup" | "keys" | "connect" | "down",
    message: string,
  ) {
    super(message);
  }
}

function secret(): string {
  const s = process.env.WHOOP_SECRET || process.env.CLAUDE_API_SECRET;
  if (!s || s.length < 16 || !DB_URL) throw new WhoopError("setup", "The server isn't set up for this.");
  return createHmac("sha256", s).update("hugo-whoop-secret:v1").digest("hex");
}

export function isApp(key: unknown): boolean {
  return typeof key === "string" && timingSafeEqual(createHash("sha256").update(key).digest(), createHash("sha256").update(DATA_KEY).digest());
}

/* ---------- the keys and tokens, locked, in the database ---------- */

const storeUrl = (s: string) => `${DB_URL}/spaces/srv-${createHmac("sha256", s).update(`whoop:${DATA_KEY}`).digest("hex").slice(0, 40)}/whoop.json`;
const lockKey = (s: string) => createHash("sha256").update(`whoop-lock:${s}`).digest();

function seal(s: string, value: Stored): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", lockKey(s), iv);
  const body = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}

function unseal(s: string, text: unknown): Stored {
  if (typeof text !== "string" || !text) return {};
  try {
    const raw = Buffer.from(text, "base64");
    const d = createDecipheriv("aes-256-gcm", lockKey(s), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8")) as Stored;
  } catch {
    return {};
  }
}

async function read(s: string): Promise<Stored> {
  const res = await fetch(storeUrl(s), { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new WhoopError("down", "Couldn't reach the database.");
  const stored = unseal(s, await res.json());
  // Keys set on the server itself win over ones typed into the app.
  const id = process.env.WHOOP_CLIENT_ID;
  const sec = process.env.WHOOP_CLIENT_SECRET;
  return id && sec ? { ...stored, clientId: id, clientSecret: sec } : stored;
}

async function save(s: string, value: Stored): Promise<void> {
  const res = await fetch(storeUrl(s), { method: "PUT", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(seal(s, value)), signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new WhoopError("down", "Couldn't reach the database.");
}

/** Tell the app whether there is a WHOOP to show (hub/settings/whoop), and nothing more. */
async function flag(on: boolean): Promise<void> {
  await fetch(`${DB_URL}/spaces/${encodeURIComponent(DATA_KEY)}/hub/settings/whoop.json`, { method: "PUT", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(on ? true : null), signal: AbortSignal.timeout(8000) }).catch(() => undefined);
}

/* ---------- connecting ---------- */

const KEY_RE = /^[A-Za-z0-9_-]{16,128}$/;

/** Keep the registered app's two keys. They are checked for shape only: WHOOP says whether they're right. */
export async function saveKeys(clientId: unknown, clientSecret: unknown): Promise<void> {
  if (typeof clientId !== "string" || typeof clientSecret !== "string" || !KEY_RE.test(clientId.trim()) || !KEY_RE.test(clientSecret.trim())) throw new WhoopError("keys", "Those don't look like WHOOP's Client ID and Client Secret.");
  const s = secret();
  await save(s, { clientId: clientId.trim(), clientSecret: clientSecret.trim() });
}

const sign = (s: string, at: string) => createHmac("sha256", s).update(`whoop-state:${at}`).digest("hex").slice(0, 32);
export const redirectUri = (origin: string) => `${origin}/api/whoop/callback`;

/** Where to send him to approve the connection. Throws "keys" when the app's keys haven't been given yet. */
export async function authorizeUrl(origin: string, now = Date.now()): Promise<string> {
  const s = secret();
  const { clientId, clientSecret } = await read(s);
  if (!clientId || !clientSecret) throw new WhoopError("keys", "WHOOP's keys are needed first.");
  const at = String(now);
  const q = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri(origin), scope: SCOPE, state: `${at}.${sign(s, at)}` });
  return `${AUTH_URL}?${q}`;
}

type Tokens = { access_token?: string; refresh_token?: string; expires_in?: number };

async function token(params: Record<string, string>): Promise<Tokens | null> {
  const res = await fetch(TOKEN_URL, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params), signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as Tokens | null;
}

/** He approved: swap the code WHOOP sent back for tokens, and keep them. */
export async function finish(code: string, state: string, origin: string, now = Date.now()): Promise<void> {
  const s = secret();
  const [at, mark] = state.split(".");
  const fresh = Number(at) > now - STATE_MS && Number(at) <= now + 60_000;
  if (!fresh || !mark || mark.length !== 32 || !timingSafeEqual(Buffer.from(mark), Buffer.from(sign(s, at)))) throw new WhoopError("connect", "That link has expired.");
  const stored = await read(s);
  if (!stored.clientId || !stored.clientSecret) throw new WhoopError("keys", "WHOOP's keys are needed first.");
  const t = await token({ grant_type: "authorization_code", code, client_id: stored.clientId, client_secret: stored.clientSecret, redirect_uri: redirectUri(origin) });
  if (!t?.access_token || !t.refresh_token) throw new WhoopError("connect", "WHOOP didn't accept that.");
  await save(s, { clientId: stored.clientId, clientSecret: stored.clientSecret, access: t.access_token, refresh: t.refresh_token, expires: now + (t.expires_in ?? 3600) * 1000 });
  await flag(true);
}

/** Forget the tokens (the app's keys are kept, so connecting again is one tap). */
export async function disconnect(): Promise<void> {
  const s = secret();
  const { clientId, clientSecret } = await read(s);
  await save(s, { clientId, clientSecret });
  await flag(false);
}

/** A token WHOOP will accept right now, renewed if the last one has run out. */
async function accessToken(s: string, now: number): Promise<string> {
  const stored = await read(s);
  if (stored.access && (stored.expires ?? 0) > now + 60_000) return stored.access;
  if (!stored.refresh || !stored.clientId || !stored.clientSecret) throw new WhoopError("connect", "WHOOP isn't connected.");
  const t = await token({ grant_type: "refresh_token", refresh_token: stored.refresh, client_id: stored.clientId, client_secret: stored.clientSecret, scope: "offline" });
  if (t?.access_token && t.refresh_token) {
    await save(s, { ...stored, access: t.access_token, refresh: t.refresh_token, expires: now + (t.expires_in ?? 3600) * 1000 });
    return t.access_token;
  }
  // WHOOP gives a new renewal token each time and retires the old one. If something else (the phone, the nightly
  // read) renewed in the same moment, its tokens are already saved: use those.
  const again = await read(s);
  if (again.refresh && again.refresh !== stored.refresh && again.access && (again.expires ?? 0) > now) return again.access;
  // Otherwise the approval is gone (revoked in WHOOP, or unused for too long): he has to connect again.
  await save(s, { clientId: stored.clientId, clientSecret: stored.clientSecret });
  await flag(false);
  throw new WhoopError("connect", "WHOOP needs connecting again.");
}

/* ---------- the numbers ---------- */

type Page<T> = { records?: T[] };
type SleepRecord = { id?: string; cycle_id?: number; end?: string; nap?: boolean; score_state?: string; score?: { sleep_performance_percentage?: number; stage_summary?: { total_in_bed_time_milli?: number; total_awake_time_milli?: number } } };
type RecoveryRecord = { cycle_id?: number; sleep_id?: string; score_state?: string; score?: { recovery_score?: number; resting_heart_rate?: number; hrv_rmssd_milli?: number } };
type CycleRecord = { id?: number; score_state?: string; score?: { strain?: number } };

async function page<T>(path: string, access: string): Promise<T[]> {
  const res = await fetch(`${API}${path}`, { cache: "no-store", headers: { Authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new WhoopError("down", "WHOOP didn't answer.");
  return ((await res.json()) as Page<T>).records ?? [];
}

const londonDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });
const whole = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.round(n) : undefined);

/**
 * The last few days of WHOOP numbers, keyed by the day he woke up on (Europe/London), saved where the app reads
 * them. A night belongs to the morning it ended; its recovery and that day's strain go with it. Naps are left out.
 */
export async function sync(now = Date.now()): Promise<Record<string, Whoop>> {
  const s = secret();
  const access = await accessToken(s, now);
  const [sleeps, recoveries, cycles] = await Promise.all([page<SleepRecord>("/activity/sleep?limit=10", access), page<RecoveryRecord>("/recovery?limit=7", access), page<CycleRecord>("/cycle?limit=7", access)]);
  const days: Record<string, Whoop> = {};
  for (const sl of sleeps) {
    if (sl.nap || !sl.end) continue;
    const date = londonDay.format(new Date(sl.end));
    if (days[date]) continue; // newest first: the main sleep of that morning is already in
    const day: Whoop = { at: now };
    if (sl.score_state === "SCORED" && sl.score) {
      const stages = sl.score.stage_summary;
      const sleep = whole(sl.score.sleep_performance_percentage);
      if (sleep !== undefined) day.sleep = sleep;
      if (stages?.total_in_bed_time_milli) day.asleep = Math.round((stages.total_in_bed_time_milli - (stages.total_awake_time_milli ?? 0)) / 60_000);
    }
    const rec = recoveries.find((r) => r.sleep_id === sl.id || (r.cycle_id !== undefined && r.cycle_id === sl.cycle_id));
    if (rec?.score_state === "SCORED" && rec.score) {
      const recovery = whole(rec.score.recovery_score);
      const hrv = whole(rec.score.hrv_rmssd_milli);
      const rhr = whole(rec.score.resting_heart_rate);
      if (recovery !== undefined) day.recovery = recovery;
      if (hrv !== undefined) day.hrv = hrv;
      if (rhr !== undefined) day.rhr = rhr;
    }
    const strain = cycles.find((c) => c.id !== undefined && c.id === sl.cycle_id)?.score?.strain;
    if (typeof strain === "number" && Number.isFinite(strain)) day.strain = Math.round(strain * 10) / 10;
    if (Object.keys(day).length > 1) days[date] = day;
  }
  const recent = Object.fromEntries(Object.entries(days).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 4));
  if (Object.keys(recent).length) {
    await fetch(`${DB_URL}/spaces/${encodeURIComponent(DATA_KEY)}/hub/whoop.json`, { method: "PATCH", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(recent), signal: AbortSignal.timeout(8000) }).catch(() => undefined);
  }
  return recent;
}
