/**
 * "Replan": one tap opens Claude with this already written, so all that's left is to say what changed. Claude then
 * reads the day's plan from this app and moves things itself, through the app's connector.
 * Nothing about the day is in the link: Claude fetches it through the two connectors.
 */
const PROMPT = `Replan my day in Hugo. Something changed; I say what at the very end of this message (if nothing is written there, ask me first, in one line).

1. Read today's plan with Hugo's get_plan, and my day with get_day (habits, to-dos, exams).
2. Lessons, and anything I say is fixed, don't move. Move, shorten or drop the rest with set_plan_task and remove_plan_task so what's left of today still works. Keep my habits in the plan wherever they fit. Put nothing after Sleep.
3. Change the plan straight away. Don't ask me to confirm.
4. Then show me the new plan as a short timed list, and one line on what you dropped, if anything.

What changed: `;

export const REPLAN_URL = `https://claude.ai/new?q=${encodeURIComponent(PROMPT)}`;
