"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { SOUNDS, playSound } from "@/lib/sounds";
import { EDIT_MAX_BYTES, markEditUsed, uploadEdit, useEditBank } from "@/lib/edits";
import { formatClock } from "@/lib/media";
import type { HabitDef } from "@/lib/types";
import { cn } from "@/lib/cn";
import { CloseIcon, PlayIcon, PlusIcon } from "./Icons";
import EditPlayer from "./EditPlayer";
import { lockScroll } from "@/lib/scrollLock";

/** One habit: its name, its sound and its edit. Everything saves as you go. */
export default function HabitSheet({ habitId, onClose }: { habitId: string; onClose: () => void }) {
  const { data, updateSettings } = useStore();
  const bank = useEditBank();
  const index = data.settings.habits.findIndex((h) => h.id === habitId);
  const habit = data.settings.habits[index];
  const [uploading, setUploading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unlock = lockScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !preview && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, preview]);

  if (!habit) return null;
  const patch = (changes: Partial<HabitDef>) => updateSettings((s) => ({ ...s, habits: s.habits.map((h) => (h.id === habitId ? { ...h, ...changes } : h)) }));
  const edit = habit.editId ? bank.byId[habit.editId] : undefined;

  const pickEdit = (id: string | undefined) => {
    if (id) markEditUsed(id);
    patch({ editId: id });
  };

  const upload = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    setError(null);
    setUploading(0);
    try {
      const meta = await uploadEdit(file, (f) => setUploading(f));
      pickEdit(meta.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that.");
    } finally {
      setUploading(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={(e) => {
        // Only a tap on the dim background closes it, and taps inside never reach the screen behind.
        e.stopPropagation();
        if (e.target === e.currentTarget && uploading === null) onClose();
      }}
    >
      <input ref={input} type="file" accept="video/*" className="hidden" onClick={(e) => e.stopPropagation()} onChange={(e) => void upload(e.target.files?.[0])} />
      <div className="sheet-up flex max-h-[90dvh] w-full max-w-[520px] flex-col rounded-t-[22px] bg-bg" role="dialog" aria-modal="true" aria-label={habit.name}>
        <div className="flex items-start justify-between px-5 pt-5">
          <div className="label">{index === 0 ? "Your must-do" : `Habit ${index + 1}`}</div>
          <button type="button" className="tap -mr-2 -mt-1.5 flex h-9 w-9 items-center justify-center rounded-full text-ink-2" onClick={onClose} disabled={uploading !== null} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-safe">
          <input
            key={`${habit.id}:${habit.name}`}
            defaultValue={habit.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== habit.name) patch({ name: v });
              else e.target.value = habit.name;
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="mt-1 w-full border-b border-line bg-transparent pb-2 text-[24px] font-semibold tracking-[-0.03em] focus:border-ink focus:outline-none"
            aria-label="Habit name"
          />

          <div className="mt-7 text-[13px] text-muted">Sound</div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {SOUNDS.map((s) => {
              const on = habit.sound === s.id;
              const elsewhere = data.settings.habits.find((h) => h.id !== habit.id && h.sound === s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    patch({ sound: s.id });
                    playSound(s.id);
                  }}
                  aria-pressed={on}
                  title={elsewhere ? `Also on ${elsewhere.name}` : undefined}
                  className={cn("tap relative h-11 rounded-xl text-[13.5px] transition-colors", on ? "bg-ink text-bg" : "bg-surface text-ink-2")}
                >
                  {s.name}
                  {elsewhere && !on && <span className="absolute right-1.5 top-1.5 h-[4px] w-[4px] rounded-full bg-faint" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] text-muted">Tap to hear it. A grey dot means another habit already uses it.</p>

          <div className="mt-7 text-[13px] text-muted">Edit</div>
          <p className="mt-1 text-[12px] text-muted">A short video that plays full screen when you tick this habit, instead of the sound.</p>
          {edit ? (
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-surface p-2.5">
              <button type="button" onClick={() => setPreview(edit.id)} className="tap relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-ink" aria-label={`Play ${edit.name}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {edit.thumb && <img src={edit.thumb} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                <span className="absolute inset-0 flex items-center justify-center text-white">
                  <PlayIcon width={14} height={14} />
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px]">{edit.name}</div>
                <div className="font-mono text-[11.5px] text-muted">{formatClock(edit.dur)}</div>
              </div>
              <button type="button" className="h-9 shrink-0 px-3 text-[13px] text-muted" onClick={() => patch({ editId: undefined })}>
                Remove
              </button>
            </div>
          ) : null}

          <button type="button" className="btn-quiet mt-3 -ml-1 bg-surface" onClick={() => input.current?.click()} disabled={uploading !== null}>
            <PlusIcon width={16} height={16} /> {uploading !== null ? `Uploading ${Math.round(uploading * 100)}%` : edit ? "Upload a different video" : "Upload a video"}
          </button>
          {uploading !== null && (
            <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-track">
              <div className="h-full rounded-full bg-ink transition-[width] duration-300" style={{ width: `${Math.max(3, Math.round(uploading * 100))}%` }} />
            </div>
          )}
          {error && <p className="mt-2 text-[12.5px] text-ink-2">{error}</p>}
          <p className="mt-2 text-[12px] text-muted">Up to {EDIT_MAX_BYTES / 1024 / 1024} MB.</p>

          {bank.list.filter((e) => e.id !== habit.editId).length > 0 && (
            <>
              <div className="mt-6 text-[13px] text-muted">Or use one you&apos;ve uploaded</div>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {bank.list
                  .filter((e) => e.id !== habit.editId)
                  .map((e) => (
                    <div key={e.id} className="relative">
                      <button type="button" onClick={() => pickEdit(e.id)} className="tap block w-full text-left" aria-label={`Use ${e.name}`}>
                        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-ink">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {e.thumb && <img src={e.thumb} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                        </div>
                        <div className="mt-1 truncate text-[11.5px] text-ink-2">{e.name}</div>
                      </button>
                      <button type="button" onClick={() => setPreview(e.id)} className="tap absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white" aria-label={`Preview ${e.name}`}>
                        <PlayIcon width={10} height={10} />
                      </button>
                    </div>
                  ))}
              </div>
            </>
          )}
          <div className="h-8" />
        </div>
      </div>
      {preview && <EditPlayer editId={preview} onClose={() => setPreview(null)} />}
    </div>,
    document.body,
  );
}
