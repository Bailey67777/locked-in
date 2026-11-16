import { WhoopError, authorizeUrl, disconnect, isApp, saveKeys, sync } from "@/lib/server/whoop";

/**
 * POST { key, action } from the app, for the WHOOP connection (see src/lib/server/whoop.ts):
 *   "start"      → { url }: where to send him to approve it (code "keys" when the WHOOP app's keys are needed first)
 *   "keys"       → the same, after keeping { clientId, clientSecret }
 *   "sync"       → { days }: the last few days of numbers, also saved where the app reads them
 *   "disconnect" → forget the approval
 */

export const maxDuration = 30;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  let body: { key?: unknown; action?: unknown; clientId?: unknown; clientSecret?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({}, 404);
  }
  if (!isApp(body.key)) return json({}, 404);
  const origin = new URL(req.url).origin;
  try {
    switch (body.action) {
      case "keys":
        await saveKeys(body.clientId, body.clientSecret);
        return json({ url: await authorizeUrl(origin) });
      case "start":
        return json({ url: await authorizeUrl(origin) });
      case "sync":
        return json({ days: await sync() });
      case "disconnect":
        await disconnect();
        return json({ ok: true });
      default:
        return json({}, 404);
    }
  } catch (e) {
    if (e instanceof WhoopError) return json({ error: e.message, code: e.code }, e.code === "down" || e.code === "setup" ? 503 : 409);
    return json({ error: "Something went wrong.", code: "down" }, 503);
  }
}
