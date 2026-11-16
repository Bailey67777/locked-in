import { finish } from "@/lib/server/whoop";

/**
 * Where WHOOP sends him back after he approves the connection, with a one-time code. The code is swapped for
 * tokens on the server and he lands back in the app; `?whoop=` only says whether it worked.
 */

export const maxDuration = 30;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  let result = "failed";
  if (code && state) {
    try {
      await finish(code, state, url.origin);
      result = "ok";
    } catch {
      /* said by ?whoop=failed */
    }
  }
  return new Response(null, { status: 303, headers: { Location: `/?whoop=${result}`, "Cache-Control": "no-store" } });
}
