"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import { useHub } from "@/lib/hub/store";
import { AcademicsIcon, CalendarIcon, HabitsIcon, HealthIcon, SettingsIcon, StatsIcon, TodoIcon } from "./Icons";
import TodoView from "./TodoView";
import HabitsView from "./HabitsView";
import AcademicsView from "./AcademicsView";
import HealthView from "./HealthView";
import Morning from "./Morning";
import CalendarView from "./CalendarView";
import StatsView from "./StatsView";
import SettingsView from "./SettingsView";

type Tab = "habits" | "todo" | "academics" | "health" | "calendar" | "stats" | "settings";

const TABS: { id: Tab; label: string; Icon: typeof HabitsIcon }[] = [
  { id: "habits", label: "Habits", Icon: HabitsIcon },
  { id: "todo", label: "To do", Icon: TodoIcon },
  { id: "academics", label: "Academics", Icon: AcademicsIcon },
  { id: "health", label: "Health", Icon: HealthIcon },
  { id: "calendar", label: "Calendar", Icon: CalendarIcon },
  { id: "stats", label: "Stats", Icon: StatsIcon },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
];

export default function AppShell() {
  const { loaded, today } = useStore();
  const hub = useHub();
  const [tab, setTab] = useState<Tab>("habits");

  useEffect(() => {
    // Back to the tab you were on after a reload (deferred: no synchronous setState in the effect).
    const id = window.setTimeout(() => {
      try {
        // Back from approving the WHOOP connection: land on Settings, where it says whether it worked.
        if (new URLSearchParams(window.location.search).has("whoop")) {
          window.history.replaceState(null, "", window.location.pathname);
          return setTab("settings");
        }
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

  const ready = loaded && today !== "" && hub.loaded && hub.today !== "";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col">
      <div className="pt-safe" />
      <main className={cn("flex flex-1 flex-col px-5", tab === "habits" ? "pb-[calc(58px+env(safe-area-inset-bottom,0px))]" : "pb-[calc(110px+env(safe-area-inset-bottom,0px))] pt-7")}>
        {ready && (
          <>
            {tab === "habits" && <HabitsView />}
            {tab === "todo" && <TodoView />}
            {tab === "academics" && <AcademicsView />}
            {tab === "health" && <HealthView />}
            {tab === "calendar" && <CalendarView />}
            {tab === "stats" && <StatsView />}
            {tab === "settings" && <SettingsView />}
          </>
        )}
      </main>

      {ready && <Morning />}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 backdrop-blur-xl" aria-label="Sections">
        <div className="mx-auto flex h-[57px] w-full max-w-[520px] items-center justify-around px-3">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              aria-label={label}
              aria-current={tab === id ? "page" : undefined}
              className={cn("tap flex h-11 w-11 items-center justify-center rounded-full transition-colors", tab === id ? "text-ink" : "text-faint hover:text-muted")}
            >
              <Icon width={id === "settings" ? 20 : 22} height={id === "settings" ? 20 : 22} strokeWidth={tab === id ? 1.9 : 1.6} />
            </button>
          ))}
        </div>
        <div className="pb-safe" />
      </nav>
    </div>
  );
}
