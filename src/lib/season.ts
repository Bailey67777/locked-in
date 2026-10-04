export type Season = "spring" | "summer" | "autumn" | "winter";
export type SeasonChoice = Season | "auto";

export const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];
export const SEASON_LABEL: Record<Season, string> = { spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter" };
export const SEASON_EMOJI: Record<Season, string> = { spring: "🌱", summer: "☀️", autumn: "🍂", winter: "❄️" };

const CHOICE_KEY = "locked-in:season";
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Month (0–11) in Bristol, whatever timezone the device is set to. */
export function londonMonth(now = new Date()): number {
  const m = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", month: "numeric" }).format(now));
  return Number.isFinite(m) && m >= 1 ? m - 1 : now.getMonth();
}

/** UK meteorological seasons: Mar–May spring, Jun–Aug summer, Sep–Nov autumn, Dec–Feb winter. */
export function seasonForMonth(month: number): Season {
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

export function readSeasonChoice(): SeasonChoice {
  try {
    const v = localStorage.getItem(CHOICE_KEY);
    return v === "spring" || v === "summer" || v === "autumn" || v === "winter" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function writeSeasonChoice(choice: SeasonChoice) {
  try {
    if (choice === "auto") localStorage.removeItem(CHOICE_KEY);
    else localStorage.setItem(CHOICE_KEY, choice);
  } catch {
    /* ignore */
  }
}

export function resolveSeason(choice: SeasonChoice, now = new Date()): Season {
  return choice === "auto" ? seasonForMonth(londonMonth(now)) : choice;
}

/** Banner photos to try in order: this month, then this season, then the all-year banner. */
export function heroCandidates(season: Season, month: number | null): string[] {
  const list: string[] = [];
  if (month !== null) list.push(`/photos/months/${MONTHS[month]}.jpg`);
  list.push(`/photos/seasons/${season}.jpg`, "/photos/hero.jpg");
  return list;
}

/** Runs before first paint (inlined in <head>) so the right palette shows with no flash. */
export const SEASON_BOOT_SCRIPT = `(function(){try{var c=localStorage.getItem("${CHOICE_KEY}");var s=c;if(!s){var m=Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",month:"numeric"}).format(new Date()))-1;s=m>=2&&m<=4?"spring":m>=5&&m<=7?"summer":m>=8&&m<=10?"autumn":"winter";}document.documentElement.setAttribute("data-season",s);}catch(e){}})();`;
