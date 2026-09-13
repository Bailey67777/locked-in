"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import { CalendarIcon, SettingsIcon, SunIcon, TrendIcon, WaveMark } from "./Icons";
import WaveDivider from "./WaveDivider";
import TodayView from "./TodayView";
import CalendarView from "./CalendarView";
import TrendsView from "./TrendsView";
import SettingsView from "./SettingsView";

type Tab = "today" | "calendar" | "trends" | "settings";

const TABS: { id: Tab; label: string; Icon: typeof SunIcon }[] = [
  { id: "today", label: "Today", Icon: SunIcon },
  { id: "calendar", label: "Calendar", Icon: CalendarIcon },
  { id: "trends", label: "Trends", Icon: TrendIcon },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
];

export default function AppShell() {
  const { loaded, today, sync } = useStore();
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
      {/* Sky header */}
      <div className="bg-gradient-to-b from-ocean-100 via-sand-100 to-sand-50">
        <div className="pt-safe" />
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 pb-2 pt-3 lg:max-w-3xl">
          <div className="flex items-center gap-2">
            <WaveMark />
            <span className="text-lg font-extrabold tracking-tight text-ocean-900">Locked In</span>
            {sync === "offline" && <span className="ml-1 rounded-full bg-sunset-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-sunset-700">offline</span>}
          </div>
          <nav className="hidden gap-1 md:flex" aria-label="Sections">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                className={cn(
                  "tap flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold transition-colors",
                  tab === id ? "bg-white text-ocean-800 shadow-soft" : "text-ink-soft hover:bg-white/60",
                )}
              >
                <Icon width={18} height={18} />
                {label}
              </button>
            ))}
          </nav>
        </div>
        <WaveDivider />
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-1 md:pb-12 lg:max-w-3xl">
        {!ready ? (
          <div className="flex flex-col gap-4">
            <div className="h-14 animate-pulse rounded-2xl bg-sand-100" />
            <div className="h-40 animate-pulse rounded-3xl bg-sand-100" />
            <div className="h-64 animate-pulse rounded-3xl bg-sand-100" />
          </div>
        ) : tab === "today" ? (
          <TodayView />
        ) : tab === "calendar" ? (
          <CalendarView />
        ) : tab === "trends" ? (
          <TrendsView />
        ) : (
          <SettingsView />
        )}
      </main>

      {/* Bottom nav (phone) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/85 backdrop-blur md:hidden" aria-label="Sections">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              className={cn("tap flex flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-extrabold", tab === id ? "text-ocean-700" : "text-ink-muted")}
              aria-current={tab === id ? "page" : undefined}
            >
              <span className={cn("flex h-8 w-12 items-center justify-center rounded-full transition-colors", tab === id && "bg-ocean-100")}>
                <Icon />
              </span>
              {label}
            </button>
          ))}
        </div>
        <div className="pb-safe" />
      </nav>
    </div>
  );
}
