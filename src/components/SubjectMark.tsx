import type { SubjectId } from "@/lib/hub/types";
import { SUBJECT_META } from "@/lib/hub/subjects";

/** A subject's colour as a thin upright bar: the only colour the app uses outside charts. */
export default function SubjectMark({ subject, height = 20 }: { subject: SubjectId; height?: number }) {
  return <span className="w-[3px] shrink-0 rounded-full" style={{ height, background: SUBJECT_META[subject].color }} aria-hidden="true" />;
}
