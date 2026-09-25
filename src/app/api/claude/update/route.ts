import { applyUpdate, json, requireAuth, touchSync, updateSchema } from "@/lib/server/claude";

/** POST /api/claude/update — questions, feedback, grade estimates, study hours, econ content, task memory. */
export async function POST(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return json({ error: "Invalid body", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, 400);
  if (Object.keys(parsed.data).length === 0) return json({ error: "Nothing to update" }, 400);
  try {
    const written = await applyUpdate(parsed.data);
    await touchSync("lastWrite");
    return json({ ok: true, written });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Failed" }, 502);
  }
}
