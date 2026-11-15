import { createHash, timingSafeEqual } from "node:crypto";
import { eventsBetween } from "@/lib/hub/ics";

/**
 * POST { url, from, to } → { events } — the lessons in a calendar's iCal feed between two times.
 * Done on the server because calendar sites don't let a web page fetch them directly.
 */

const MAX_BYTES = 5_000_000;
const MAX_RANGE = 15 * 86400000;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Addresses on a private network or this machine: never fetched, whatever the link says. */
const PRIVATE_HOST = /^(localhost$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[|.*\.(local|internal)$)/i;

/** Only the app itself may ask (it sends its data key), so this can't be used as an open relay. */
function fromApp(key: unknown): boolean {
  const expected = process.env.NEXT_PUBLIC_DATA_KEY || "default";
  if (typeof key !== "string") return false;
  return timingSafeEqual(createHash("sha256").update(key).digest(), createHash("sha256").update(expected).digest());
}

export async function POST(req: Request) {
  let body: { url?: unknown; from?: unknown; to?: unknown; key?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  if (!fromApp(body.key)) return json({ error: "Not allowed" }, 404);
  const from = Number(body.from);
  const to = Number(body.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > MAX_RANGE) return json({ error: "Bad range" }, 400);

  let url: URL;
  try {
    url = new URL(String(body.url ?? "").trim().replace(/^webcals?:\/\//i, "https://"));
  } catch {
    return json({ error: "That isn't a link." }, 400);
  }
  if (url.protocol !== "https:" || PRIVATE_HOST.test(url.hostname)) return json({ error: "Use the calendar's https link." }, 400);

  try {
    const res = await fetch(url, { headers: { Accept: "text/calendar, */*" }, cache: "no-store", signal: AbortSignal.timeout(12_000), redirect: "follow" });
    // A redirect must not lead somewhere the first check would have refused.
    const landed = new URL(res.url || url.href);
    if (landed.protocol !== "https:" || PRIVATE_HOST.test(landed.hostname)) return json({ error: "Use the calendar's https link." }, 400);
    if (!res.ok) return json({ error: `The calendar said ${res.status}.` }, 502);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return json({ error: "That calendar is too big." }, 502);
    const text = await res.text();
    if (text.length > MAX_BYTES) return json({ error: "That calendar is too big." }, 502);
    if (!text.includes("BEGIN:VCALENDAR")) return json({ error: "That link isn't an iCal calendar." }, 502);
    return json({ events: eventsBetween(text, from, to) });
  } catch {
    return json({ error: "Couldn't reach the calendar." }, 502);
  }
}
