import type { PoseId, SubjectId } from "./types";

export const SUBJECT_IDS: SubjectId[] = ["maths", "physics", "econ"];

/** Each subject's colour is a CSS variable (globals.css), tuned for light and dark. */
/**
 * `top` is the best grade a test in that subject is marked out of: his Maths and Physics tests go up to A, his
 * Economics ones up to A*. A result is shown against it ("B / A").
 */
export const SUBJECT_META: Record<SubjectId, { name: string; board: string; color: string; on: string; top: string }> = {
  maths: { name: "Maths", board: "Edexcel", color: "var(--maths)", on: "var(--on-maths)", top: "A" },
  physics: { name: "Physics", board: "AQA", color: "var(--physics)", on: "var(--on-physics)", top: "A" },
  econ: { name: "Economics", board: "AQA", color: "var(--econ)", on: "var(--on-econ)", top: "A*" },
};

export const isSubject = (v: unknown): v is SubjectId => typeof v === "string" && (SUBJECT_IDS as string[]).includes(v);

/** Which subject a calendar event belongs to, from its title. */
export function subjectFromTitle(title: string): SubjectId | null {
  const t = title.toLowerCase();
  if (/\becon|economics/.test(t)) return "econ";
  if (/\bphys/.test(t)) return "physics";
  if (/\bmath|further|\bfm\b|mechanics|statistics|\bpure\b/.test(t)) return "maths";
  return null;
}

/** A-level grades, best first. */
export const GRADES = ["A*", "A", "B", "C", "D", "E", "U"];
export const gradeRank = (g: string | undefined) => (g ? GRADES.length - 1 - GRADES.indexOf(g) : -1);

/** The five daily progress photos, in the order they're taken. */
export const POSES: { id: PoseId; name: string; short: string }[] = [
  { id: "face-front", name: "Face, front", short: "Face" },
  { id: "face-side", name: "Face, side", short: "Face side" },
  { id: "body-front", name: "Body, front", short: "Front" },
  { id: "body-side", name: "Body, side", short: "Side" },
  { id: "back", name: "Back", short: "Back" },
];
export const POSE_IDS: PoseId[] = POSES.map((p) => p.id);
export const isPose = (v: unknown): v is PoseId => typeof v === "string" && (POSE_IDS as string[]).includes(v);
