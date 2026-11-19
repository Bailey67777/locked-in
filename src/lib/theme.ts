/** Light, dark or follow the phone. Kept per device (an iPad on a desk and a phone in bed can differ). */
export type ThemeChoice = "system" | "light" | "dark";

const KEY = "locked-in:theme";

export function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    /* ignore */
  }
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

/**
 * The app's look: its colours and typefaces. "classic" is the original black and white, which follows light/dark;
 * the others each have one palette of their own. Kept per device, like the theme.
 */
export type Look = "classic" | "autumn" | "winter" | "scholar" | "sunset";
export const LOOKS: { id: Look; name: string; colours: [string, string, string] }[] = [
  { id: "autumn", name: "Autumn", colours: ["#f6ebd9", "#c8551b", "#3b2414"] },
  { id: "winter", name: "Winter", colours: ["#070b14", "#7cc0ff", "#eaf4ff"] },
  { id: "scholar", name: "Scholar", colours: ["#17120d", "#c2a26b", "#e8dcc4"] },
  { id: "sunset", name: "Sunset", colours: ["#fff3e6", "#ff5fa2", "#1b1030"] },
  { id: "classic", name: "Classic", colours: ["#f4f4f3", "#000000", "#7a7a7a"] },
];
const LOOK_KEY = "locked-in:look";
/** What a device shows until a look is chosen on it. */
const FIRST_LOOK: Look = "autumn";

export function readLook(): Look {
  try {
    const v = localStorage.getItem(LOOK_KEY);
    return LOOKS.some((l) => l.id === v) ? (v as Look) : FIRST_LOOK;
  } catch {
    return FIRST_LOOK;
  }
}

export function applyLook(look: Look) {
  try {
    localStorage.setItem(LOOK_KEY, look);
  } catch {
    /* ignore */
  }
  const root = document.documentElement;
  if (look === "classic") root.removeAttribute("data-look");
  else root.setAttribute("data-look", look);
}

/** Runs before the first paint so the chosen look and theme never flash the wrong colours. */
export const THEME_BOOT_SCRIPT = `try{var d=document.documentElement,t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);var l=localStorage.getItem("${LOOK_KEY}")||"${FIRST_LOOK}";if(/^(autumn|winter|scholar|sunset)$/.test(l))d.setAttribute("data-look",l)}catch(e){}`;
