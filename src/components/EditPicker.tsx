"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { EDIT_MAX_BYTES, markEditUsed, uploadEdit, useEditBank } from "@/lib/edits";
import { MEDIA_BUDGET_BYTES, storedSize } from "@/lib/vlog";
import { formatBytes, formatClock } from "@/lib/model";
import { cn } from "@/lib/cn";
import { CloseIcon, PlusIcon } from "./Icons";
import EditPlayer from "./EditPlayer";

type Props = { current?: string; itemName: string; onPick: (editId: string | undefined) => void; onClose: () => void };

/** Choose the edit that plays when an item is ticked: one from the bank, or upload a new one. */
export default function EditPicker({ current, itemName, onPick, onClose }: Props) {
  const { data } = useStore();
  const bank = useEditBank();
  const [uploading, setUploading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const used = Object.values(data.days).reduce((n, d) => n + (d.vlog ? storedSize(d.vlog.bytes) : 0), 0) + bank.list.reduce((n, e) => n + storedSize(e.bytes), 0);
  const full = used >= MEDIA_BUDGET_BYTES;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !preview && uploading === null && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, preview, uploading]);

  const choose = (id: string | undefined) => {
    if (id) markEditUsed(id);
    onPick(id);
    onClose();
  };

  const upload = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    setError(null);
    setUploading(0);
    try {
      const meta = await uploadEdit(file, (f) => setUploading(f));
      setUploading(null);
      choose(meta.id);
    } catch (e) {
      setUploading(null);
      setError(e instanceof Error ? e.message : "Couldn't upload that.");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center md:p-6" onClick={() => uploading === null && onClose()}>
      <input ref={input} type="file" accept="video/*" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
      <div className="flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-sand-50 shadow-lift md:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Pick an edit">
        <div className="flex items-center justify-between border-b border-sand-200 bg-white/80 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <div className="label">Edit for</div>
            <div className="truncate font-serif text-[20px] leading-tight text-ink">{itemName}</div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} disabled={uploading !== null} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="overflow-y-auto p-4 pb-safe">
          <p className="card-desc">Plays full screen when you tick this. Pick one you&apos;ve used before or upload a new one (up to {EDIT_MAX_BYTES / 1024 / 1024} MB).</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <button type="button" className="btn-primary flex-1" onClick={() => input.current?.click()} disabled={uploading !== null || full}>
              <PlusIcon width={16} height={16} /> {uploading !== null ? `Uploading… ${Math.round(uploading * 100)}%` : "Upload a new edit"}
            </button>
            {current && (
              <button type="button" className="btn-ghost bg-white/70" onClick={() => choose(undefined)} disabled={uploading !== null}>
                No edit
              </button>
            )}
          </div>
          {uploading !== null && (
            <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-black/[0.06]">
              <div className="grad-fill h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(4, Math.round(uploading * 100))}%` }} />
            </div>
          )}
          {full && <p className="mt-2 text-[12px] font-bold text-sunset-600">Storage is full ({formatBytes(used)}). Delete some edits or old vlogs in Settings first.</p>}
          {error && <p className="mt-2 text-[12px] font-bold text-sunset-600">{error}</p>}

          {!bank.ready ? (
            <p className="mt-4 text-center text-[13px] text-ink-muted">Loading your edits…</p>
          ) : bank.list.length === 0 ? (
            <p className="mt-4 rounded-xl bg-white/60 px-3 py-3 text-center text-[13px] text-ink-muted">No edits yet. Upload your first one above.</p>
          ) : (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {bank.list.map((e) => (
                <div key={e.id} className={cn("relative overflow-hidden rounded-xl bg-white/70 shadow-soft", current === e.id && "ring-2 ring-ink")}>
                  <button type="button" onClick={() => choose(e.id)} disabled={uploading !== null} className="tap block w-full text-left" aria-label={`Use ${e.name}`}>
                    <div className="relative aspect-[3/4] w-full bg-black/80">
                      {e.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.thumb} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center text-2xl">🎬</span>
                      )}
                      {e.dur > 0 && <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 font-mono text-[10px] text-white">{formatClock(e.dur)}</span>}
                      {current === e.id && <span className="absolute left-1 top-1 rounded-full bg-white px-1.5 text-[10px] font-bold text-ink">✓ on</span>}
                    </div>
                    <div className="truncate px-2 py-1.5 text-[12px] font-bold text-ink">{e.name}</div>
                  </button>
                  <button type="button" onClick={() => setPreview(e.id)} className="tap absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-[11px] text-white" aria-label={`Preview ${e.name}`}>
                    ▶
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {preview && <EditPlayer editId={preview} onClose={() => setPreview(null)} />}
    </div>,
    document.body,
  );
}
