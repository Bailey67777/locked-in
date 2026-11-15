"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./Icons";
import { lockScroll } from "@/lib/scrollLock";

/** A panel that slides up from the bottom. A tap on the dim background or Escape closes it. */
export default function Sheet({ label, accent, onClose, children, footer }: { label: React.ReactNode; accent?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    const unlock = lockScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-up flex max-h-[92dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[22px] bg-bg sm:rounded-[22px]" role="dialog" aria-modal="true">
        {accent && <div className="h-[3px] w-full shrink-0" style={{ background: accent }} />}
        <div className="flex shrink-0 items-start justify-between px-5 pt-5">
          <div className="label">{label}</div>
          <button type="button" className="tap -mr-2 -mt-1.5 flex h-9 w-9 items-center justify-center rounded-full text-ink-2" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className={footer ? "min-h-0 flex-1 overflow-y-auto px-5 pb-5" : "min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] sm:pb-5"}>{children}</div>
        {footer && <div className="shrink-0 border-t border-line px-5 pb-[calc(16px+env(safe-area-inset-bottom,0px))] pt-4 sm:pb-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
