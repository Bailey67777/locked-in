"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import { CalendarIcon, DailyIcon, HourglassIcon, JournalIcon, MoreIcon, PlanIcon, SettingsIcon, SunIcon, TrendIcon, WaveMark } from "./Icons";
import WaveDivider from "./WaveDivider";
import TodayView from "./TodayView";
import CalendarView from "./CalendarView";
import TrendsView from "./TrendsView";
import SettingsView from "./SettingsView";
import PlannerView from "./PlannerView";
import JournalView from "./JournalView";
import DailyView from "./DailyView";
import CountdownView from "./CountdownView";
import PhotoWall from "./PhotoWall";
import ReminderRunner from "./ReminderRunner";

type Tab = "today" | "plan" | "journal" | "calendar" | "daily" | "countdown" | "trends" | "settings";

const TABS: { id: Tab; label: string; Icon: typeof SunIcon }[] = [
  { id: "today", label: "Today", Icon: SunIcon },
  { id: "plan", label: "Plan", Icon: PlanIcon },
  { id: "journal", label: "Journal", Icon: JournalIcon },
  { id: "calendar", label: "Calendar", Icon: CalendarIcon },
  { id: "daily", label: "Daily", Icon: DailyIcon },
  { id: "countdown", label: "Countdowns", Icon: HourglassIcon },
  { id: "trends", label: "Trends", Icon: TrendIcon },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
];

/** On a phone the first four get a slot in the bottom bar; the rest live behind "More". */
const PRIMARY: Tab[] = ["today", "plan", "journal", "calendar"];

export default function AppShell() {
  const { loaded, today, sync } = useStore();
  const [tab, setTab] = useState<Tab>("today");
  const [moreOpen, setMoreOpen] = useState(false);

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
    setMoreOpen(false);
    try {
      sessionStorage.setItem("locked-in:tab", t);
    } catch {
      /* ignore */
    }
    window.scrollTo({ top: 0 });
  };

  const ready = loaded && today !== "";
  const inMore = !PRIMARY.includes(tab);

  return (
    <div className="flex min-h-dvh flex-col">
      <ReminderRunner />

      {/* Sky header */}
      <div className="bg-gradient-to-b from-ocean-100 via-sand-100 to-sand-50">
        <div className="pt-safe" />
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 pb-2 pt-3 lg:max-w-5xl">
          <div className="flex shrink-0 items-center gap-2">
            <WaveMark />
            <span className="text-lg font-extrabold tracking-tight text-ocean-900">Locked In</span>
            {sync === "offline" && <span className="ml-1 rounded-full bg-sunset-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-sunset-700">offline</span>}
          </div>
          <nav className="hidden items-center gap-0.5 md:flex" aria-label="Sections">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                title={label}
                className={cn(
                  "tap flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-extrabold transition-colors",
                  tab === id ? "bg-white text-ocean-800 shadow-soft" : "text-ink-soft hover:bg-white/60",
                )}
              >
                <Icon width={18} height={18} />
                <span className={cn(tab === id ? "inline" : "hidden xl:inline")}>{label}</span>
              </button>
            ))}
          </nav>
        </div>
        <WaveDivider />
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-1 md:pb-12 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-10">
        <div className="min-w-0">
          {!ready ? (
            <div className="flex flex-col gap-4">
              <div className="h-14 animate-pulse rounded-2xl bg-sand-100" />
              <div className="h-40 animate-pulse rounded-3xl bg-sand-100" />
              <div className="h-64 animate-pulse rounded-3xl bg-sand-100" />
            </div>
          ) : tab === "today" ? (
            <TodayView />
          ) : tab === "plan" ? (
            <PlannerView />
          ) : tab === "journal" ? (
            <JournalView />
          ) : tab === "calendar" ? (
            <CalendarView />
          ) : tab === "daily" ? (
            <DailyView />
          ) : tab === "countdown" ? (
            <CountdownView />
          ) : tab === "trends" ? (
            <TrendsView />
          ) : (
            <SettingsView />
          )}
        </div>
        <div className="hidden lg:block">
          <PhotoWall />
        </div>
      </main>

      {/* "More" sheet (phone) */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-ocean-900/30 backdrop-blur-sm md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="pop-in mb-[4.5rem] w-full px-3 pb-safe" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-4 gap-2 rounded-3xl bg-white p-3 shadow-lift">
              {TABS.filter((t) => !PRIMARY.includes(t.id)).map(({ id, label, Icon }) => (
                <button key={id} type="button" onClick={() => go(id)} className={cn("tap flex flex-col items-center gap-1 rounded-2xl px-1 py-3 text-[11px] font-extrabold", tab === id ? "bg-ocean-100 text-ocean-800" : "text-ink-soft hover:bg-sand-50")}>
                  <Icon />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav (phone) */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/70 bg-white/90 backdrop-blur md:hidden" aria-label="Sections">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {TABS.filter((t) => PRIMARY.includes(t.id)).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              className={cn("tap flex flex-col items-center gap-0.5 pb-1 pt-2 text-[11px] font-extrabold", tab === id ? "text-ocean-700" : "text-ink-muted")}
              aria-current={tab === id ? "page" : undefined}
            >
              <span className={cn("flex h-8 w-12 items-center justify-center rounded-full transition-colors", tab === id && "bg-ocean-100")}>
                <Icon />
              </span>
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={cn("tap flex flex-col items-center gap-0.5 pb-1 pt-2 text-[11px] font-extrabold", inMore || moreOpen ? "text-ocean-700" : "text-ink-muted")}
            aria-expanded={moreOpen}
          >
            <span className={cn("flex h-8 w-12 items-center justify-center rounded-full transition-colors", (inMore || moreOpen) && "bg-ocean-100")}>
              <MoreIcon />
            </span>
            {inMore ? TABS.find((t) => t.id === tab)?.label : "More"}
          </button>
        </div>
        <div className="pb-safe" />
      </nav>
    </div>
  );
}
