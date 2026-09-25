import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Server side of the nightly Claude task. Talks to the Realtime Database over REST with the same URL and
 * data key the app uses (the rules allow it), and never touches /days/<date>/journal* or /photos.
 */

const DB_URL = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "").replace(/\/$/, "");
const DATA_KEY = process.env.NEXT_PUBLIC_DATA_KEY || "default";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Bearer check in constant time. Returns a Response to send if the request is not allowed. */
export function requireAuth(req: Request): Response | null {
  const secret = process.env.CLAUDE_API_SECRET;
  if (!secret || secret.length < 16) return json({ error: "CLAUDE_API_SECRET is not configured on the server." }, 503);
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const a = createHash("sha256").update(token).digest();
  const b = createHash("sha256").update(secret).digest();
  if (!token || !timingSafeEqual(a, b)) return json({ error: "Unauthorized" }, 401);
  return null;
}

function dbConfigured(): boolean {
  return Boolean(DB_URL);
}

async function dbFetch(path: string, init?: RequestInit): Promise<unknown> {
  if (!dbConfigured()) throw new Error("Database URL is not configured on the server.");
  const res = await fetch(`${DB_URL}/spaces/${DATA_KEY}/${path}.json`, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`Database ${init?.method ?? "GET"} ${path} failed: ${res.status}`);
  return res.json();
}

export const dbGet = (path: string) => dbFetch(path);
export const dbPatch = (path: string, body: Record<string, unknown>) => dbFetch(path, { method: "PATCH", body: JSON.stringify(body) });
export const dbPut = (path: string, body: unknown) => dbFetch(path, { method: "PUT", body: JSON.stringify(body) });

export function isDate(s: unknown): s is string {
  return typeof s === "string" && DATE_RE.test(s) && !Number.isNaN(new Date(`${s}T00:00`).getTime());
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export async function touchSync(field: "lastRead" | "lastWrite") {
  try {
    await dbPatch("study/sync", { [field]: Date.now() });
  } catch {
    /* status is best-effort */
  }
}

/* ---------- what the task is allowed to read ---------- */

const Q_SUBJECTS = ["maths", "physics", "econ"] as const;
type QSubject = (typeof Q_SUBJECTS)[number];

export type DayView = {
  date: string;
  submitted: { at: number; iso: string; local: string; pct: number; tier: string } | null;
  habits: { done: number; total: number };
  todos: { done: number; total: number };
  academic: { econ: string; maths: string; physics: string };
  questions: Record<QSubject, { topic: string; question: string; why?: string; answer: string; feedback?: { mark: string; comment: string; correctAnswer?: string } } | null>;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown): Record<string, unknown>[] => {
  const arr = Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v as object) : [];
  return arr.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"));
};

function londonTime(ts: number): string {
  return new Date(ts).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Build the day view from raw database nodes, copying ONLY allow-listed fields. The journal never passes through here. */
export function buildDayView(date: string, dayRaw: unknown, questionsRaw: unknown, feedbackRaw: unknown): DayView {
  const day = (dayRaw && typeof dayRaw === "object" ? dayRaw : {}) as Record<string, unknown>;
  const sub = (day.submitted && typeof day.submitted === "object" ? day.submitted : null) as Record<string, unknown> | null;
  const habits = list(day.habits);
  const todos = list(day.todos);
  const ac = (day.academic && typeof day.academic === "object" ? day.academic : {}) as Record<string, unknown>;
  const answers = (day.answers && typeof day.answers === "object" ? day.answers : {}) as Record<string, unknown>;
  const qs = (questionsRaw && typeof questionsRaw === "object" ? questionsRaw : {}) as Record<string, unknown>;
  const fbs = (feedbackRaw && typeof feedbackRaw === "object" ? feedbackRaw : {}) as Record<string, unknown>;
  const questions = {} as DayView["questions"];
  for (const s of Q_SUBJECTS) {
    const q = (qs[s] && typeof qs[s] === "object" ? qs[s] : null) as Record<string, unknown> | null;
    if (!q || !str(q.question)) {
      questions[s] = null;
      continue;
    }
    const fb = (fbs[s] && typeof fbs[s] === "object" ? fbs[s] : null) as Record<string, unknown> | null;
    questions[s] = {
      topic: str(q.topic),
      question: str(q.question),
      ...(str(q.why) ? { why: str(q.why) } : {}),
      answer: str(answers[s]),
      ...(fb ? { feedback: { mark: str(fb.mark), comment: str(fb.comment), ...(str(fb.correctAnswer) ? { correctAnswer: str(fb.correctAnswer) } : {}) } } : {}),
    };
  }
  const at = sub && typeof sub.at === "number" ? sub.at : null;
  return {
    date,
    submitted: at ? { at, iso: new Date(at).toISOString(), local: londonTime(at), pct: Number(sub?.pct) || 0, tier: str(sub?.tier) } : null,
    habits: { done: habits.filter((h) => h.done === true).length, total: habits.length },
    todos: { done: todos.filter((t) => t.done === true).length, total: todos.length },
    academic: { econ: str(ac.econ), maths: str(ac.maths), physics: str(ac.physics) },
    questions,
  };
}

export async function readDay(date: string): Promise<DayView> {
  const [dayRaw, qRaw, fRaw] = await Promise.all([dbGet(`days/${date}`), dbGet(`study/questions/${date}`), dbGet(`study/feedback/${date}`)]);
  return buildDayView(date, dayRaw, qRaw, fRaw);
}

export async function readMemory(): Promise<string> {
  const m = (await dbGet("study/memory")) as { text?: unknown } | null;
  return str(m?.text);
}

const LABEL: Record<QSubject, string> = { maths: "Maths", physics: "Physics", econ: "Economics" };

function weekday(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

export function dayToMarkdown(v: DayView): string {
  const lines: string[] = [];
  lines.push(`# ${v.date} (${weekday(v.date)})`, "");
  lines.push(v.submitted ? `Submitted: yes, ${v.submitted.local} (${v.submitted.pct}%, tier ${v.submitted.tier})` : "Submitted: no (still open)");
  lines.push(`Habits: ${v.habits.done}/${v.habits.total} done · To-dos: ${v.todos.done}/${v.todos.total} done`, "");
  lines.push("## Academic journal");
  for (const [k, label] of [["econ", "Economics"], ["maths", "Maths (incl. Further Maths)"], ["physics", "Physics"]] as const) {
    lines.push(`### ${label}`, v.academic[k].trim() ? v.academic[k].trim() : "_(nothing written)_", "");
  }
  lines.push("## Questions set for this day");
  let any = false;
  for (const s of Q_SUBJECTS) {
    const q = v.questions[s];
    if (!q) continue;
    any = true;
    lines.push(`### ${LABEL[s]}${q.topic ? ` — ${q.topic}` : ""}`, `Q: ${q.question}`);
    if (q.why) lines.push(`Why: ${q.why}`);
    lines.push(`Answer: ${q.answer.trim() ? q.answer.trim() : "_(no answer)_"}`);
    if (q.feedback) lines.push(`Feedback already given: ${q.feedback.mark}${q.feedback.comment ? ` — ${q.feedback.comment}` : ""}`);
    lines.push("");
  }
  if (!any) lines.push("_(no questions were set for this day)_", "");
  return lines.join("\n");
}

/* ---------- what the task is allowed to write ---------- */

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
const qSubject = z.enum(["maths", "physics", "econ"]);
const subject = z.enum(["maths", "further", "physics", "econ"]);

const questionItem = z.object({ subject: qSubject, topic: z.string().max(200), question: z.string().min(1).max(4000), why: z.string().max(600).optional() });

export const updateSchema = z
  .object({
    questions: z.object({ date: dateSchema, items: z.array(questionItem).min(1).max(3) }).optional(),
    feedback: z
      .array(z.object({ date: dateSchema, subject: qSubject, mark: z.string().max(40), comment: z.string().max(4000), correctAnswer: z.string().max(4000).optional() }))
      .max(30)
      .optional(),
    gradeEstimates: z.array(z.object({ date: dateSchema, subject, grade: z.number().min(0).max(6), reason: z.string().max(600) })).max(60).optional(),
    studyHours: z.array(z.object({ weekStart: dateSchema, subject, hours: z.number().min(0).max(100) })).max(60).optional(),
    econ: z
      .object({
        date: dateSchema,
        concept: z.object({ title: z.string().min(1).max(200), explanation: z.string().max(4000) }).optional(),
        reading: z.array(z.object({ title: z.string().min(1).max(300), source: z.string().max(120), url: z.string().url().startsWith("https://"), why: z.string().max(600) })).max(6).optional(),
      })
      .optional(),
    /** The task's own scratch memory (weak topics, what's been covered). Free text, replaces the previous value. */
    memory: z.string().max(20000).optional(),
  })
  .strict();

export type UpdateBody = z.infer<typeof updateSchema>;

/** Apply an update. Everything is keyed by date (and subject), so re-posting overwrites instead of duplicating. */
export async function applyUpdate(body: UpdateBody): Promise<Record<string, unknown>> {
  const now = Date.now();
  const done: Record<string, unknown> = {};
  if (body.questions) {
    const patch: Record<string, unknown> = { setAt: now };
    for (const item of body.questions.items) patch[item.subject] = { subject: item.subject, topic: item.topic, question: item.question, ...(item.why ? { why: item.why } : {}) };
    await dbPatch(`study/questions/${body.questions.date}`, patch);
    done.questions = { date: body.questions.date, subjects: body.questions.items.map((i) => i.subject) };
  }
  if (body.feedback?.length) {
    for (const f of body.feedback) {
      await dbPatch(`study/feedback/${f.date}`, { [f.subject]: { mark: f.mark, comment: f.comment, ...(f.correctAnswer ? { correctAnswer: f.correctAnswer } : {}), at: now } });
    }
    done.feedback = body.feedback.map((f) => `${f.date}/${f.subject}`);
  }
  if (body.gradeEstimates?.length) {
    const patch: Record<string, unknown> = {};
    for (const g of body.gradeEstimates) patch[`${g.subject}/${g.date}`] = { grade: Math.round(g.grade * 100) / 100, reason: g.reason, at: now };
    await dbPatch("study/grades", patch);
    done.gradeEstimates = body.gradeEstimates.map((g) => `${g.subject}@${g.date}=${g.grade}`);
  }
  if (body.studyHours?.length) {
    const patch: Record<string, unknown> = {};
    for (const h of body.studyHours) patch[`${h.weekStart}/${h.subject}`] = Math.round(h.hours * 10) / 10;
    await dbPatch("study/hours", patch);
    done.studyHours = body.studyHours.map((h) => `${h.weekStart}/${h.subject}=${h.hours}`);
  }
  if (body.econ) {
    const patch: Record<string, unknown> = { at: now };
    if (body.econ.concept) patch.concept = body.econ.concept;
    if (body.econ.reading) patch.reading = body.econ.reading;
    await dbPatch(`study/econ/${body.econ.date}`, patch);
    done.econ = { date: body.econ.date, concept: Boolean(body.econ.concept), reading: body.econ.reading?.length ?? 0 };
  }
  if (typeof body.memory === "string") {
    await dbPut("study/memory", { text: body.memory, at: now });
    done.memory = { chars: body.memory.length };
  }
  return done;
}
