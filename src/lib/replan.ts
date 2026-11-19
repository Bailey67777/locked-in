/**
 * "Replan": one tap opens Claude with this already written, so all that's left is to say what changed. Claude then
 * reads the day (Structured for the plan, this app for lessons, habits and to-dos) and moves things itself.
 * Nothing about the day is in the link: Claude fetches it through the two connectors.
 */
const PROMPT = `Replan my day in Structured. Something changed; I say what at the very end of this message (if nothing is written there, ask me first, in one line).

1. Read today's tasks in Structured, and my day in Hugo (lessons, habits, to-dos).
2. If today has almost nothing in Structured yet, build the day first: my lessons as tasks at their real times, then my habits and to-dos at sensible times around them.
3. Lessons, and anything I say is fixed, don't move. Move, shorten or drop the rest so what's left of today still works. Keep my habits in the plan wherever they fit. Put nothing after my Sleep task.
4. Change Structured straight away. Don't ask me to confirm.
5. Then show me the new plan as a short timed list, and one line on what you dropped, if anything.

What changed: `;

export const REPLAN_URL = `https://claude.ai/new?q=${encodeURIComponent(PROMPT)}`;
