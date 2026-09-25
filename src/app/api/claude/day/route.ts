import { dayToMarkdown, isDate, json, readDay, readMemory, requireAuth, touchSync } from "@/lib/server/claude";

/** GET /api/claude/day?date=YYYY-MM-DD[&format=markdown] — one day, for the nightly Claude task. */
export async function GET(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!isDate(date)) return json({ error: "date must be YYYY-MM-DD" }, 400);
  try {
    const [day, memory] = await Promise.all([readDay(date), readMemory()]);
    await touchSync("lastRead");
    if (url.searchParams.get("format") === "markdown") {
      const md = `${dayToMarkdown(day)}\n## Task memory\n${memory.trim() || "_(empty)_"}\n`;
      return new Response(md, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "no-store" } });
    }
    return json({ day, memory });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Failed" }, 502);
  }
}
