import { addDays, dayToMarkdown, isDate, json, readDay, readMemory, requireAuth, touchSync } from "@/lib/server/claude";

const MAX_DAYS = 31;

/** GET /api/claude/range?from=YYYY-MM-DD&to=YYYY-MM-DD[&format=markdown] — every day in the range (max 31). */
export async function GET(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!isDate(from) || !isDate(to) || from > to) return json({ error: "from and to must be YYYY-MM-DD with from <= to" }, 400);
  const dates: string[] = [];
  for (let d = from; d <= to && dates.length < MAX_DAYS; d = addDays(d, 1)) dates.push(d);
  if (addDays(dates[dates.length - 1], 0) < to) return json({ error: `range too long: at most ${MAX_DAYS} days` }, 400);
  try {
    const [days, memory] = await Promise.all([Promise.all(dates.map(readDay)), readMemory()]);
    await touchSync("lastRead");
    if (url.searchParams.get("format") === "markdown") {
      const md = `${days.map(dayToMarkdown).join("\n---\n\n")}\n## Task memory\n${memory.trim() || "_(empty)_"}\n`;
      return new Response(md, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "no-store" } });
    }
    return json({ from, to, days, memory });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Failed" }, 502);
  }
}
