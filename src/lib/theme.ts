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
 * The app's look: "classic" is the original black and white; the four seasons share one style and differ in colour.
 * Every look has a light and a dark side and follows the theme above. Kept per device, like the theme.
 */
export type Look = "classic" | "spring" | "summer" | "autumn" | "winter";
/** Background, accent and text of each look's dark side, for the swatch in Settings. */
export const LOOKS: { id: Look; name: string; colours: [string, string, string] }[] = [
  { id: "spring", name: "Spring", colours: ["#06120c", "#5fe6a2", "#eafff2"] },
  { id: "summer", name: "Summer", colours: ["#120f05", "#ffd23f", "#fff8e0"] },
  { id: "autumn", name: "Autumn", colours: ["#140b06", "#ff7a38", "#feeede"] },
  { id: "winter", name: "Winter", colours: ["#070b14", "#7cc0ff", "#eaf4ff"] },
  { id: "classic", name: "Classic", colours: ["#f4f4f3", "#000000", "#7a7a7a"] },
];
const LOOK_KEY = "locked-in:look";
/** What a device shows until a look is chosen on it. */
const FIRST_LOOK: Look = "winter";

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
export const THEME_BOOT_SCRIPT = `try{var d=document.documentElement,t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);var l=localStorage.getItem("${LOOK_KEY}");if(!/^(spring|summer|autumn|winter|classic)$/.test(l))l="${FIRST_LOOK}";if(l!=="classic")d.setAttribute("data-look",l)}catch(e){}`;
