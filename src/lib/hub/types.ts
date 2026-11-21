/**
 * Everything the Academics, Health and To-do parts of the app keep. It lives at <space>/hub in the database, apart
 * from the habits (which stay exactly where Locked In always kept them). Photo files are not in here: only their
 * labels are; the encrypted files live at <space>/body.
 */

export type SubjectId = "maths" | "physics" | "econ";

/** One lesson in the weekly timetable. Times are "HH:MM". */
export type TimetableLesson = { id: string; subject: SubjectId; start: string; end: string };

export type Exam = { title: string; date: string; subject?: SubjectId };

export type HubSettings = {
  /** Target grade per subject. */
  targets: Partial<Record<SubjectId, string>>;
  /** Stare at Wall length in minutes. */
  stareMin: number;
  /** Weekday (0 = Sunday … 6 = Saturday) → lessons that day. */
  timetable: Record<string, TimetableLesson[]>;
  /** A calendar's private iCal (.ics) address. When set, it decides the day's lessons. */
  calendarUrl: string;
  /** Grades dated before this day count as "before", on or after it as "now". */
  shiftDate: string;
  exams: Record<string, Exam>;
  /** The link to his own Claude chat for changing the day's plan (his "quick structured" chat). The replan button opens it. */
  quickChat: string;
  /** A WHOOP is connected. The keys for it stay on the server; this only says there is something to show. */
  whoop: boolean;
};

/** What you said about one lesson. `conf`: 1 shaky, 2 okay, 3 solid. */
export type LessonLog = { subject: SubjectId; text: string; conf?: 1 | 2 | 3; at: number };

/** Claude's notes on one subject for one day, written by the Claude connector. */
export type ClaudeNote = { summary: string; solid: string[]; open: string[] };

export type HubDay = {
  /** Keyed by lesson key: "physics@08:30" for a timed lesson, "physics" for a day without a timetable. */
  logs: Record<string, LessonLog>;
  claude?: { at: number; subjects: Partial<Record<SubjectId, ClaudeNote>> };
};

export type Session = { subject: SubjectId; start: number; end: number };
export type Stare = { start: number; end: number };
export type Grade = { subject: SubjectId; grade: string; date: string; label: string; score?: string; at: number };
export type Timer = { subject: SubjectId; start: number } | null;

/**
 * A to-do. `when: "day"` belongs to a day (`date`): today's list is everything dated today or earlier that isn't
 * done; tomorrow's is everything dated later. `when: "later"` is the "for a while" list. `done` is when it was ticked.
 */
export type Todo = { text: string; when: "day" | "later"; date?: string; done?: number; at: number };

export type PoseId = "face-front" | "face-side" | "body-front" | "body-side" | "back";

/**
 * The label for one progress photo. The photo itself is encrypted at <space>/body/<id> (a full-size copy and a
 * thumbnail). A replaced photo gets a new id, so a label always points at exactly one picture.
 */
export type PhotoMeta = { id: string; at: number; w: number; h: number; bytes: number };

/** AES-GCM ciphertext + IV, both base64. */
export type Sealed = { iv: string; ct: string };

/**
 * What a device needs to unlock the photos with the six-digit code. Holds no secret: the photo key is in here only
 * wrapped (encrypted) by a key made from the code together with a value only the app's server can work out.
 */
export type Vault = { v: 2; salt: string; iterations: number; wrapped: Sealed; at: number };

/** Claude's mark for a whole day, out of 10 to two decimals. `seen` is when it was shown on screen. */
export type Rating = { score: number; at: number; why?: string; seen?: number };

/**
 * One morning's numbers from the WHOOP: recovery and sleep as percentages, minutes asleep, heart-rate variability
 * (ms), resting heart rate, and the day's strain so far (0–21). Whatever it hasn't worked out yet is left off.
 */
export type Whoop = { recovery?: number; sleep?: number; asleep?: number; hrv?: number; rhr?: number; strain?: number; at: number };

/**
 * The day plan. A rule is something that happens at the same time on set weekdays (wake up, read, train). A day's
 * entries are either one-off things for that day, or, under a rule's id, what's different about that rule on that
 * day: done, moved, shortened or skipped. Times are minutes from midnight.
 */
export type PlanColor = "accent" | "red" | "blue" | "yellow" | "green" | "violet";
/** `habit`: the id of the habit this is. Ticking either one ticks the other, so nothing is ticked twice. */
export type PlanRule = { title: string; start: number; dur: number; days: number[]; from: string; color?: PlanColor; habit?: string };
export type PlanEntry = { title?: string; start?: number; dur?: number; color?: PlanColor; done?: number; skip?: boolean };
export type Plan = { rules: Record<string, PlanRule>; days: Record<string, Record<string, PlanEntry>> };
/** One thing on a day's timeline, rule and that day's changes already merged. */
export type PlanTask = { id: string; title: string; start: number; dur: number; color: PlanColor; done: number; repeats: boolean; habit?: string };

export type HubData = {
  settings: HubSettings;
  days: Record<string, HubDay>;
  sessions: Record<string, Session>;
  stares: Record<string, Stare>;
  grades: Record<string, Grade>;
  timer: Timer;
  todos: Record<string, Todo>;
  /** date → pose → label. */
  photos: Record<string, Partial<Record<PoseId, PhotoMeta>>>;
  /** date → the one thing eaten that day that shouldn't have been. */
  goy: Record<string, string>;
  /** date → Claude's rating of that day. */
  ratings: Record<string, Rating>;
  /** date (the morning woken up on) → that day's WHOOP numbers. */
  whoop: Record<string, Whoop>;
  plan: Plan;
  /** The last day the morning card was put away, on any device. */
  morning: string;
  vault: Vault | null;
};

/** A lesson as shown on a day: from the calendar, the timetable, or just the subject. */
export type DayLesson = { key: string; subject: SubjectId; start?: string; end?: string; title?: string };
