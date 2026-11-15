import { TOOLS, callTool, connectorSecret, hasTool, safeEqual } from "@/lib/server/hub";

/**
 * The Claude connector: a remote MCP server (Streamable HTTP, stateless, JSON-RPC 2.0 by hand) at
 * /api/mcp/<CLAUDE_API_SECRET>. The secret in the path is the only credential, so the link is the key.
 *
 * POST takes one JSON-RPC message (or an array of them) and answers with plain JSON; there is no SSE stream and
 * no session, so GET and DELETE are 405. Route Handlers aren't cached in this version of Next.js (and a POST never
 * is), so there is no `dynamic` export; every response also says `no-store`.
 */

export const maxDuration = 30;

const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const HEADERS = { "Cache-Control": "no-store" };
const MAX_BODY = 1_000_000;
const MAX_BATCH = 20;

const INSTRUCTIONS = [
  'This is Hugo\'s own app ("Hugo": his habits, academics and health). He is an A-level student: Maths (with Further Maths), Physics and Economics.',
  "When he runs /today or starts talking about what he did at school, call get_day first. It already has his lessons and what he said about each one, so don't ask him to repeat it.",
  "What he says is dictated, so read past transcription slips.",
  "When a subject has been worked through, call save_lesson_notes once for that subject.",
  "Use add_todo when he asks to be reminded of something.",
  "Dates are YYYY-MM-DD and \"today\" is the date in Europe/London.",
].join(" ");

type Ctx = { params: Promise<{ token: string }> };
type Id = string | number;
type RpcResponse = { jsonrpc: "2.0"; id: Id | null; result: unknown } | { jsonrpc: "2.0"; id: Id | null; error: { code: number; message: string } };

const ok = (id: Id, result: unknown): RpcResponse => ({ jsonrpc: "2.0", id, result });
const fail = (id: Id | null, code: number, message: string): RpcResponse => ({ jsonrpc: "2.0", id, error: { code, message } });
const send = (body: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(body, { status, headers: { ...HEADERS, ...extra } });

/** A Response to send when the link isn't the right one (or the server has no secret), else null. */
async function refuse(ctx: Ctx): Promise<Response | null> {
  const secret = connectorSecret();
  if (!secret) return send({ error: "CLAUDE_API_SECRET is not configured on the server." }, 503);
  const { token } = await ctx.params;
  let decoded = token;
  try {
    decoded = decodeURIComponent(token);
  } catch {
    /* not percent-encoded: compare it as it came */
  }
  const match = safeEqual(token, secret) || safeEqual(decoded, secret);
  return match ? null : send({}, 404);
}

/** One message in. A request gets a response; a notification, or a reply to something we never asked, gets null. */
async function handle(message: unknown): Promise<RpcResponse | null> {
  if (!message || typeof message !== "object" || Array.isArray(message)) return fail(null, -32600, "Invalid Request");
  const m = message as Record<string, unknown>;
  const id = typeof m.id === "string" || typeof m.id === "number" ? m.id : null;
  if (m.jsonrpc !== "2.0") return fail(id, -32600, "Invalid Request: jsonrpc must be \"2.0\"");
  if (typeof m.method !== "string") {
    if (id !== null && ("result" in m || "error" in m)) return null;
    return fail(id, -32600, "Invalid Request: method is missing");
  }
  if (!("id" in m)) return null;
  if (id === null) return fail(null, -32600, "Invalid Request: id must be a string or a number");
  const params = (m.params && typeof m.params === "object" && !Array.isArray(m.params) ? m.params : {}) as Record<string, unknown>;

  switch (m.method) {
    case "initialize": {
      const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      return ok(id, {
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "hugo", title: "Hugo", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: TOOLS });
    case "tools/call": {
      if (typeof params.name !== "string" || !params.name) return fail(id, -32602, "Invalid params: name is required");
      if (!hasTool(params.name)) return fail(id, -32602, `Unknown tool: ${params.name.slice(0, 80)}`);
      return ok(id, await callTool(params.name, params.arguments));
    }
    default:
      return fail(id, -32601, `Method not found: ${m.method.slice(0, 80)}`);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const refused = await refuse(ctx);
  if (refused) return refused;

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return send(fail(null, -32600, "Invalid Request: too large"), 413);
    body = JSON.parse(text);
  } catch {
    return send(fail(null, -32700, "Parse error"), 400);
  }

  const accepted = () => new Response(null, { status: 202, headers: HEADERS });
  if (Array.isArray(body)) {
    if (!body.length || body.length > MAX_BATCH) return send(fail(null, -32600, "Invalid Request: a batch needs 1 to 20 messages"), 400);
    const replies: RpcResponse[] = [];
    // One at a time, so writes land in the order they were sent.
    for (const message of body) {
      const reply = await handle(message);
      if (reply) replies.push(reply);
    }
    return replies.length ? send(replies) : accepted();
  }
  const reply = await handle(body);
  if (!reply) return accepted();
  // A message that isn't valid JSON-RPC at all is a bad HTTP request too; every other error is a normal answer.
  return send(reply, "error" in reply && reply.error.code === -32600 ? 400 : 200);
}

/**
 * No server-to-client stream (GET) and no sessions to end (DELETE). Every other method is answered here too,
 * rather than by the framework, so that without the right token they all look like a page that doesn't exist.
 */
async function notAllowed(ctx: Ctx): Promise<Response> {
  return (await refuse(ctx)) ?? send(fail(null, -32000, "Method not allowed: this server only takes POST"), 405, { Allow: "POST" });
}

export async function GET(_req: Request, ctx: Ctx) {
  return notAllowed(ctx);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return notAllowed(ctx);
}

export async function PUT(_req: Request, ctx: Ctx) {
  return notAllowed(ctx);
}

export async function PATCH(_req: Request, ctx: Ctx) {
  return notAllowed(ctx);
}

export async function OPTIONS(_req: Request, ctx: Ctx) {
  return (await refuse(ctx)) ?? new Response(null, { status: 204, headers: { ...HEADERS, Allow: "POST" } });
}
