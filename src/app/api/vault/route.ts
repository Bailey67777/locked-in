import { pepperFor } from "@/lib/server/vault";

/**
 * POST { key, salt, proof } → { pepper }: the server's part of unlocking the photos with the six-digit code.
 * See src/lib/server/vault.ts for why it exists. Answers a few times an hour at most.
 */

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function POST(req: Request) {
  let body: { key?: unknown; salt?: unknown; proof?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({}, 404);
  }
  const result = await pepperFor(body);
  if (result.ok) return json({ pepper: result.pepper });
  if (result.status === 429) return json({ error: "Too many tries.", retryIn: result.retryIn ?? 0 }, 429, { "Retry-After": String(Math.ceil((result.retryIn ?? 0) / 1000)) });
  return json({}, result.status);
}
