"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import { SEASON_LABEL } from "@/lib/season";
import { CalendarIcon, HealthIcon, SettingsIcon, StudyIcon, SunIcon } from "./Icons";
import TodayView from "./TodayView";
import StudyView from "./StudyView";
import CalendarView from "./CalendarView";
import TrendsView from "./TrendsView";
import SettingsView from "./SettingsView";
import ReminderRunner from "./ReminderRunner";
import VideoGate from "./VideoGate";

type Tab = "today" | "study" | "health" | "calendar" | "settings";

const TABS: { id: Tab; label: string; Icon: typeof SunIcon }[] = [
  { id: "today", label: "Today", Icon: SunIcon },
  { id: "study", label: "Study", Icon: StudyIcon },
  { id: "health", label: "Health", Icon: HealthIcon },
  { id: "calendar", label: "Calendar", Icon: CalendarIcon },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
];

export default function AppShell() {
  const { loaded, today, sync, pending, season } = useStore();
  const [tab, setTab] = useState<Tab>("today");

  useEffect(() => {
    // Restore the last open tab (deferred: avoids a synchronous setState during the effect).
    const id = window.setTimeout(() => {
      try {
        const saved = sessionStorage.getItem("locked-in:tab") as Tab | null;
        if (saved && TABS.some((t) => t.id === saved)) setTab(saved);
      } catch {
        /* ignore */
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const go = (t: Tab) => {
    setTab(t);
    try {
      sessionStorage.setItem("locked-in:tab", t);
    } catch {
      /* ignore */
    }
    window.scrollTo({ top: 0 });
  };

  const ready = loaded && today !== "";

  return (
    <div className="flex min-h-dvh flex-col">
      <ReminderRunner />
      <VideoGate />

      <header className="sticky top-0 z-40 border-b border-black/[0.05] bg-sand-50/75 backdrop-blur-xl">
        <div className="pt-safe" />
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 py-2.5 md:max-w-2xl">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ocean-600 text-[13px] font-extrabold text-white shadow-soft">L</span>
            <span className="text-[15px] font-extrabold tracking-[-0.02em] text-ink">Locked In</span>
            <span className="hidden text-[11px] font-semibold text-ink-muted sm:inline">· {SEASON_LABEL[season]}</span>
            {sync === "offline" && (
              <span className="chip ml-1 bg-sunset-100 text-sunset-700">
                offline{pending > 0 ? ` · ${pending}` : ""}
              </span>
            )}
          </div>
          <nav className="hidden items-center gap-0.5 rounded-full border border-black/[0.06] bg-white/70 p-1 md:flex" aria-label="Sections">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                className={cn(
                  "tap rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors",
                  tab === id ? "bg-ink text-white" : "text-ink-soft hover:text-ink",
                )}
                aria-current={tab === id ? "page" : undefined}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-32 pt-5 md:max-w-2xl md:pb-16">
        {!ready ? (
          <div className="flex flex-col gap-3">
            <div className="h-12 animate-pulse rounded-2xl bg-sand-100" />
            <div className="h-36 animate-pulse rounded-3xl bg-sand-100" />
            <div className="h-56 animate-pulse rounded-3xl bg-sand-100" />
          </div>
        ) : tab === "today" ? (
          <TodayView />
        ) : tab === "study" ? (
          <StudyView />
        ) : tab === "health" ? (
          <TrendsView />
        ) : tab === "calendar" ? (
          <CalendarView />
        ) : (
          <SettingsView />
        )}
      </main>

      {/* Bottom nav (phone) */}
      <nav className="fixed inset-x-0 bottom-0 z-50 px-4 md:hidden" aria-label="Sections">
        <div className="mx-auto mb-2 grid max-w-sm grid-cols-5 rounded-2xl border border-black/[0.06] bg-white/85 p-1 shadow-lift backdrop-blur-xl">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              className={cn("tap flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold transition-colors", tab === id ? "bg-ocean-50 text-ocean-700" : "text-ink-muted")}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon width={19} height={19} strokeWidth={tab === id ? 2.2 : 1.8} />
              {label}
            </button>
          ))}
        </div>
        <div className="pb-safe" />
      </nav>
    </div>
  );
}
