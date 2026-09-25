export type HabitDef = {
  id: string;
  name: string;
  emoji?: string; // e.g. "🌅"
  color?: string; // hex, e.g. "#1a6fd1"
  time?: string; // "HH:MM" — when in the day it happens; used for ordering
  sound?: string; // id from sounds.ts
  /** Must-do habit: if it's missed, the submitted day drops straight to the bottom tier. */
  keystone?: boolean;
};

export type DayHabit = { id: string; name: string; done: boolean };

export type Todo = { id: string; text: string; done: boolean };

/** 1–10, or 0 when not set yet. */
export type Ratings = { day: number; health: number; happy: number };

/** One block in the (no longer shown) day plan. Kept so old data survives. */
export type PlanItem = {
  id: string;
  title: string;
  start: string; // "HH:MM"
  mins: number;
  color?: string;
  emoji?: string;
  done: boolean;
};

export type TierId = "t80" | "t50" | "t25" | "t0";

/** Written when the day is submitted (finalised). */
export type Submission = {
  at: number;
  pct: number;
  tier: TierId;
  keystoneMissed: boolean;
};

/** AES-GCM ciphertext + IV, both base64. Only ever produced on the device. */
export type EncryptedText = { iv: string; ct: string };

/** End-of-day active recall, one box per subject (Maths covers Further Maths). Not encrypted. */
export type AcademicJournal = { econ: string; maths: string; physics: string };

export type QSubject = "maths" | "physics" | "econ";

/** Your answers to the three questions Claude set for that day. */
export type Answers = Partial<Record<QSubject, string>>;

export type DayRecord = {
  date: string; // YYYY-MM-DD
  habits: DayHabit[]; // snapshot of the habit list for this day
  todos: Todo[];
  ratings: Ratings;
  /** Legacy plaintext journal. Only present until the journal has been encrypted; never written again after that. */
  journal?: string;
  /** Legacy plaintext active recall (the old second journal). Merged into the encrypted journal on migration. */
  recall?: string;
  /** The personal journal, encrypted on the device. */
  journalEnc?: EncryptedText;
  academic?: AcademicJournal;
  answers?: Answers;
  song?: string; // song of the day
  screenMinutes?: number; // phone screen time, typed in by hand
  plan?: PlanItem[];
  submitted?: Submission;
  thumb?: string; // tiny JPEG data URL shown on the calendar
  updatedAt?: number;
};

export type Countdown = {
  id: string;
  title: string;
  at: string; // local "YYYY-MM-DDTHH:MM"
  color: string;
  emoji?: string;
};

export type Reminders = {
  /** Browser notifications while the app is open (desktop / Android). */
  browser: boolean;
  /** Phone push through the free ntfy app. Off unless a topic is set and this is on. */
  ntfy: boolean;
  ntfyTopic: string;
  /** Evening nudge to submit the day, "HH:MM". */
  submitTime: string;
};

export type Settings = {
  name: string;
  habits: HabitDef[];
  soundsOn: boolean;
  dayCompleteSound: string;
  todoSound: string;
  /** Old Countdowns tab data. No longer shown, kept so nothing is lost. */
  countdowns: Countdown[];
  reminders: Reminders;
  /** First A-level exam, "YYYY-MM-DD". Drives the Today countdown and the Study graph. */
  examDate?: string;
};

/* ---------- Study: written by the nightly Claude task ---------- */

export type Subject = "maths" | "further" | "physics" | "econ";

export type Question = { subject: QSubject; topic: string; question: string; why?: string };
export type DayQuestions = Partial<Record<QSubject, Question>> & { setAt?: number };

export type Feedback = { mark: string; comment: string; correctAnswer?: string; at?: number };
export type DayFeedback = Partial<Record<QSubject, Feedback>>;

/** A grade estimate: 0 = U, 1 = E, 2 = D, 3 = C, 4 = B, 5 = A, 6 = A*. Decimals allowed. */
export type GradePoint = { grade: number; reason: string; at?: number };

export type ReadingItem = { title: string; source: string; url: string; why: string };
export type EconDay = { concept?: { title: string; explanation: string }; reading?: ReadingItem[]; at?: number };

export type StudyData = {
  questions: Record<string, DayQuestions>; // by date
  feedback: Record<string, DayFeedback>; // by date
  grades: Record<Subject, Record<string, GradePoint>>; // subject → date → point
  hours: Record<string, Partial<Record<Subject, number>>>; // weekStart (Monday, YYYY-MM-DD) → subject → hours
  econ: Record<string, EconDay>; // by date
  sync: { lastRead?: number; lastWrite?: number };
};

/** Parameters needed to unlock the journal on any device. Contains no secrets. */
export type JournalCrypto = {
  v: 1;
  salt: string; // base64
  iterations: number;
  verifier: EncryptedText; // a known phrase, encrypted: proves a passphrase is right
  updatedAt: number;
};

export type AppData = {
  settings: Settings;
  days: Record<string, DayRecord>;
  study: StudyData;
  journalCrypto: JournalCrypto | null;
};
