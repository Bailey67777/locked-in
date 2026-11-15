import type { ClaudeNote } from "@/lib/hub/types";
import { cn } from "@/lib/cn";

function Points({ label, items, strong }: { label: string; items: string[]; strong?: boolean }) {
  return (
    <div className="mt-3">
      <div className="label">{label}</div>
      <ul className="mt-1.5 space-y-1">
        {items.map((t, i) => (
          <li key={i} className={cn("flex gap-2 text-[14.5px] leading-snug", strong ? "text-ink" : "text-ink-2")}>
            <span className="text-muted">–</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What Claude wrote back about a lesson after talking it through: a summary, what's solid, what's still open. */
export default function ClaudeNotes({ note, className }: { note: ClaudeNote; className?: string }) {
  return (
    <section className={className}>
      <div className="text-[13px] text-muted">From Claude</div>
      <div className="mt-2 rounded-2xl bg-surface px-4 py-3.5">
        {note.summary && <p className="text-[14.5px] leading-snug text-ink-2">{note.summary}</p>}
        {note.solid.length > 0 && <Points label="Solid" items={note.solid} />}
        {note.open.length > 0 && <Points label="Still open" items={note.open} strong />}
      </div>
    </section>
  );
}
