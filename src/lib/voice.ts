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

const AUDIO: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
/** Microphones worn on the head: AirPods and other earphones. */
const EARPHONES = /airpods|earpods|earphone|earbud|headset|headphone|hands-?free|bluetooth|buds|beats/i;

const pause = (ms: number) => new Promise<void>((done) => window.setTimeout(done, ms));

/** The microphone's name as the phone gives it, without the browser's extras ("Default - ", "(Bluetooth)"). */
export function micName(track: MediaStreamTrack | undefined): string {
  return (track?.label ?? "")
    .replace(/^default\s*[-–:]\s*/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

/**
 * Open the microphone, on the AirPods (or other earphones) whenever they're connected. A phone usually switches to
 * them by itself; where it has kept its own microphone, they're asked for by name. Earphones take a moment to
 * change over from playing to listening, so recording waits for that rather than losing the first words.
 */
export async function openMic(): Promise<MediaStream> {
  const media = navigator.mediaDevices;
  let stream = await media.getUserMedia({ audio: AUDIO });
  try {
    if (!EARPHONES.test(stream.getAudioTracks()[0]?.label ?? "")) {
      // Names are only given once the microphone has been allowed, which it now has.
      const ear = (await media.enumerateDevices()).find((d) => d.kind === "audioinput" && d.deviceId && d.deviceId !== "default" && EARPHONES.test(d.label));
      if (ear) {
        stream.getTracks().forEach((t) => t.stop());
        stream = await media.getUserMedia({ audio: { ...AUDIO, deviceId: { exact: ear.deviceId } } }).catch(() => media.getUserMedia({ audio: AUDIO }));
      }
    }
  } catch {
    /* the microphone it opened first still records */
  }
  const track = stream.getAudioTracks()[0];
  if (track && EARPHONES.test(track.label)) {
    if (track.muted) await Promise.race([new Promise<void>((done) => track.addEventListener("unmute", () => done(), { once: true })), pause(1500)]);
    await pause(450);
  }
  return stream;
}

export function recorderSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
}
