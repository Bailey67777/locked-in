/**
 * The picture in each plan item's bubble. One can be chosen by hand; otherwise it is picked from the item's name
 * (the first rule below that matches), so "Read", "Gym" or "Dentist" get the right one without any choosing.
 */
export const PLAN_ICONS = ["⏰", "🌙", "☀️", "🤸", "🏋️", "🏃", "🚶", "🧘", "📚", "💻", "✍️", "📖", "🎓", "📐", "⚛️", "📈", "🍽️", "🥤", "💧", "🚿", "🔴", "📵", "📞", "🩺", "🛒", "🧹", "🎮", "🎵", "🚗", "✈️", "💤", "⭐"];

const RULES: [RegExp, string][] = [
  [/\bwake|alarm|get up\b/i, "⏰"],
  [/\bsleep|bed\b|lights out/i, "🌙"],
  [/\bsun\b|sunlight|ground/i, "☀️"],
  [/mobility|stretch|yoga/i, "🤸"],
  [/exercise|gym|lift|train|workout|weights|squash|rugby|football|sport/i, "🏋️"],
  [/\brun\b|running|cardio|sprint/i, "🏃"],
  [/\bwalk|steps\b/i, "🚶"],
  [/stare|meditat|breath/i, "🧘"],
  [/red light/i, "🔴"],
  [/tech off|no phone|screens? off|phone off/i, "📵"],
  [/\bread/i, "📖"],
  [/maths|math\b|further/i, "📐"],
  [/physics/i, "⚛️"],
  [/econ|micro|macro/i, "📈"],
  [/lesson|school|class|lecture/i, "🎓"],
  [/essay|write|notes|journal/i, "✍️"],
  [/work|study|revis|homework|prep|past paper|practice/i, "📚"],
  [/breakfast|lunch|dinner|eat|meal|food|cook/i, "🍽️"],
  [/water|hydrate/i, "💧"],
  [/shake|protein|drink/i, "🥤"],
  [/shower|bath|wash|teeth|cleanse/i, "🚿"],
  [/call|phone|ring\b/i, "📞"],
  [/dentist|doctor|chiro|physio|appointment/i, "🩺"],
  [/shop|buy|groceries/i, "🛒"],
  [/clean|tidy|laundry|plants/i, "🧹"],
  [/drive|driving|car\b|lift to/i, "🚗"],
  [/nap|rest\b|relax/i, "💤"],
  [/game|gaming/i, "🎮"],
  [/music|piano|guitar/i, "🎵"],
];

export function autoIcon(title: string): string {
  return RULES.find(([re]) => re.test(title))?.[1] ?? "⭐";
}
