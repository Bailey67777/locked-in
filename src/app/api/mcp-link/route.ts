import { connectorSecret, safeEqual } from "@/lib/server/hub";

/**
 * POST { key } → { url } — the link to paste into claude.ai as a custom connector.
 * The link holds CLAUDE_API_SECRET, which must never be in the JavaScript the browser downloads, so Settings asks
 * for it here and proves it is the app by sending the data key it already has. Anything else gets a 404.
 */

const HEADERS = { "Cache-Control": "no-store" };

/** Where the app is being served from, as the browser sees it (behind a proxy the request URL is internal). */
function origin(req: Request): string {
  const first = (name: string) => (req.headers.get(name) ?? "").split(",")[0].trim().toLowerCase();
  const url = new URL(req.url);
  const host = first("x-forwarded-host");
  const proto = first("x-forwarded-proto");
  const safeHost = /^[a-z0-9.-]+(:\d{1,5})?$/.test(host) ? host : url.host;
  const safeProto = proto === "http" || proto === "https" ? proto : url.protocol.replace(":", "");
  return `${safeProto}://${safeHost}`;
}

export async function POST(req: Request) {
  let key: unknown;
  try {
    key = ((await req.json()) as { key?: unknown } | null)?.key;
  } catch {
    key = undefined;
  }
  const dataKey = process.env.NEXT_PUBLIC_DATA_KEY;
  if (!dataKey || typeof key !== "string" || !safeEqual(key, dataKey)) return Response.json({}, { status: 404, headers: HEADERS });
  const secret = connectorSecret();
  if (!secret) return Response.json({ error: "CLAUDE_API_SECRET is not configured on the server." }, { status: 503, headers: HEADERS });
  return Response.json({ url: `${origin(req)}/api/mcp/${encodeURIComponent(secret)}` }, { headers: HEADERS });
}
