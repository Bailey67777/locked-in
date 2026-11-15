# The Claude connector

The app can be added to claude.ai as a custom connector. Once it is, any Claude chat can see your school day and
write back into the app, so you can talk a lesson through with Claude without typing anything out twice.

## What it lets Claude do

- **Read your day.** Your lessons in order, what you said about each one and how it felt, how long you studied,
  your habits, your to-dos, upcoming exams, and your grades and targets.
- **Save lesson notes.** After you have worked a subject through, Claude writes a short summary, what is now
  solid and what is still open. The app shows these under the lesson.
- **Look at your progress.** Study time, lessons talked through, habits and grades over the last few weeks.
- **Keep small things up to date.** Add a grade, log study time you did away from the timer, set or remove an
  exam date, and add or tick off to-dos ("remind me to...").

It cannot see your journal, voice notes, photos, weight, vlogs or edits. Those are never read by the connector.

## Adding it to claude.ai

1. Open the app, go to **Settings**, and copy your connector link.
2. In claude.ai open **Settings → Connectors → Add custom connector**.
3. Give it a name (for example "Hugo"), paste the link, and add it.
4. In a chat, switch the connector on. The first time Claude uses a tool it asks for permission.

The link is the key: anyone who has it can read and change the things listed above. Don't share it. If it ever
leaks, change `CLAUDE_API_SECRET` on the server (Vercel → Settings → Environment Variables), redeploy, then copy
the new link from Settings and replace the connector in claude.ai.

## The tools

Dates are `YYYY-MM-DD` and "today" is the date in London. Subjects are `maths` (includes Further Maths),
`physics` and `econ`.

| Tool | What it does |
| --- | --- |
| `get_day` | Reads one day: lessons with what you said and how each felt, study minutes, saved notes, habits, to-dos, exams, grades. |
| `save_lesson_notes` | Saves Claude's notes for one subject on one day: a summary, the points you now have, the points still open. |
| `get_progress` | Reads the last N days (14 unless asked, up to 120): study time, lessons talked through, habits, grades, exams, Stare at Wall sessions. |
| `add_grade` | Records a grade (A* to U) for a subject, with an optional label and mark. |
| `log_study` | Adds study time for a subject (1 to 600 minutes) on a day. |
| `set_exam` | Adds an exam or changes its date, matched by title. Leaving the date out removes it. |
| `list_todos` | Reads the three to-do lists: today, tomorrow, for a while. |
| `add_todo` | Adds a to-do for today, tomorrow or later. |
| `complete_todo` | Ticks a to-do off, or unticks it. |

## For whoever maintains it

- The server is `src/app/api/mcp/[token]/route.ts` (MCP over Streamable HTTP, stateless, JSON responses only).
  The tools and the database access are in `src/lib/server/hub.ts`.
- The token in the path must equal `CLAUDE_API_SECRET` (at least 16 characters). A wrong token gets a 404.
- `src/app/api/mcp-link/route.ts` hands the link to the Settings page: `POST { key }` with the data key returns
  `{ url }`. This keeps the secret out of the browser bundle.
