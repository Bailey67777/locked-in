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
export type Look = "classic" | "spring" | "summer" | "autumn" | "winter" | "santacruz" | "primal" | "midnight" | "forest" | "rose" | "steel" | "gold" | "ocean" | "dusk" | "volt";
/** Background, accent and text of each look's dark side, for the swatch in Settings. */
export const LOOKS: { id: Look; name: string; colours: [string, string, string] }[] = [
  { id: "spring", name: "Spring", colours: ["#06120c", "#5fe6a2", "#eafff2"] },
  { id: "summer", name: "Summer", colours: ["#120f05", "#ffd23f", "#fff8e0"] },
  { id: "autumn", name: "Autumn", colours: ["#140b06", "#ff7a38", "#feeede"] },
  { id: "winter", name: "Winter", colours: ["#070b14", "#7cc0ff", "#eaf4ff"] },
  { id: "santacruz", name: "Santa Cruz", colours: ["#040e10", "#2ecabb", "#e5f6f8"] },
  { id: "primal", name: "Primal", colours: ["#100b09", "#ff7468", "#f9f1ed"] },
  { id: "midnight", name: "Midnight", colours: ["#0b0b15", "#c295ff", "#f0f1ff"] },
  { id: "forest", name: "Forest", colours: ["#060e09", "#edb333", "#eaf6ed"] },
  { id: "rose", name: "Rose", colours: ["#12090b", "#ff819e", "#fdeef1"] },
  { id: "steel", name: "Steel", colours: ["#0a0c0f", "#6dbfd3", "#eff3f7"] },
  { id: "gold", name: "Gold", colours: ["#0e0c08", "#e6b731", "#f5f2ec"] },
  { id: "ocean", name: "Ocean", colours: ["#030e15", "#00c9d1", "#e4f5ff"] },
  { id: "dusk", name: "Dusk", colours: ["#110911", "#ffa156", "#faeefa"] },
  { id: "volt", name: "Volt", colours: ["#0a0d09", "#94d600", "#eff4ed"] },
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
export const THEME_BOOT_SCRIPT = `try{var d=document.documentElement,t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);var l=localStorage.getItem("${LOOK_KEY}");if(!/^(spring|summer|autumn|winter|santacruz|primal|midnight|forest|rose|steel|gold|ocean|dusk|volt|classic)$/.test(l))l="${FIRST_LOOK}";if(l!=="classic")d.setAttribute("data-look",l)}catch(e){}`;
