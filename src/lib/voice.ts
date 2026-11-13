/**
 * The voice journal: talk, it records, you can listen back. Nothing is transcribed.
 *
 * A recording is saved on this device first (IndexedDB), so it's never lost, then uploaded in pieces to
 * /voice/<date>/<id>/<n>; once that's done its label goes on the day (days/<date>/voice/<id>). Like the rest of
 * the app's data it has no passphrase, and the Claude API never returns it.
 */
import { DATA_PATH } from "./firebase";
import { PENDING, tx } from "./media";

/** Longest single recording. */
export const VOICE_MAX_SECONDS = 20 * 60;
export const VOICE_BPS = 48_000;

export const voicePath = (date: string, id: string) => `${DATA_PATH}/voice/${date}/${id}`;

export type PendingVoice = {
  id: string;
  date: string;
  at: number;
  dur: number;
  bytes: number;
  mime: string;
  chunks: ArrayBuffer[];
  uploaded: number;
};

export async function putPending(p: PendingVoice): Promise<void> {
  await tx(PENDING, "readwrite", (s) => s.put(p));
}

export async function getPending(id: string): Promise<PendingVoice | null> {
  try {
    return ((await tx<PendingVoice>(PENDING, "readonly", (s) => s.get(id))) as PendingVoice | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function listPending(): Promise<PendingVoice[]> {
  try {
    return ((await tx<PendingVoice[]>(PENDING, "readonly", (s) => s.getAll())) as PendingVoice[] | undefined) ?? [];
  } catch {
    return [];
  }
}

export async function dropPending(id: string): Promise<void> {
  try {
    await tx(PENDING, "readwrite", (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}

/** Audio formats this browser can record, best first. MP4 (AAC) plays everywhere, including iPhone and iPad. */
export function voiceMimes(): string[] {
  if (typeof MediaRecorder === "undefined") return [];
  const options = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  const ok = options.filter((m) => {
    try {
      return MediaRecorder.isTypeSupported(m);
    } catch {
      return false;
    }
  });
  return ok.length ? ok : [""]; // "" = let the browser choose
}

export function recorderSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
}
