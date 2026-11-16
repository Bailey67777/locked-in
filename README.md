# Hugo

Hugo's own app (it was called Locked In): habits, academics and health in one place. Installable as a web app (PWA)
on iPhone, iPad and laptop. One person, no login. Black, white and grey, plus one colour per subject (Maths red,
Physics blue, Economics yellow): a thin marker beside each subject. Next.js + React + Tailwind, synced through a Firebase Realtime
Database.

**Seven icons at the bottom**

- **Habits** – unchanged from Locked In: today's fifteen habits, a percentage bar, each habit's own sound and edit.
  The button at the top is the voice **journal**.
- **To do** – only for ticking, like the habits: **Today** and **Miscellaneous**. To-dos are written in Settings
  (for today, tomorrow or miscellaneous) or on a day in the Calendar; one set for a later day appears under Today
  when that day comes, and anything not done stays there.
- **Academics** – three slabs, one per subject, filling the screen the way the habits do:
  - each slab shows the subject, today's lesson times, and the days until its next exam as one large number with
    the exam beside it. While one of its lessons is on, the slab fills with the subject's colour. Nothing is timed;
  - **tap a slab** for that subject's grades (kept out of sight);
  - every upcoming exam for the subject sits under its name, grouped by day ("13 days Integration · Vectors");
  - along the bottom, today's total and the week split into its seven days. No goal;
  - the two buttons at the top: **Stare at Wall** (always ten minutes of a blank screen) and **…** for grades
    before and after 15 November, and exams.
- **Health** – five photos a day: face front, face side, body front, body side, back. **Upload** takes all five at
  once and puts them in the order they were taken; tap one tile to add or replace a single photo. Under them:
  **Random day** (spins to a past day's five) and **Goy Eaten Today:** (one line).
- **Calendar** – as before; a day's square also carries a dash if there was study, a square if there are photos and
  a dot for a journal entry, the month shows its average rating, and the day sheet shows Claude's rating, the
  study, the lesson notes and the photos. Today and days to come can be given to-dos.
- **Statistics** – Claude's **day rating out of 10**, averaged over 7 / 30 / 365 days (the habit percentage sits
  small underneath), every day as a bar, random recordings, random body progress, the **best three and worst
  three habits**, then study hours.
- **Settings** – habits, to-dos, lessons (timetable or calendar link), exams, the photo code,
  the Claude connector link, sound, light/dark, sync.

## The day rating

Claude marks each finished day out of 10, to two decimals, through the connector's `rate_day` tool (it reads the
day first: habits, study, lessons, to-dos, photos, with the timetable in mind). The next time the app is opened,
the number comes up once, full screen; a tap puts it away on every device.

## Photos are locked

Everything else in the app is protected only by an unguessable address. The photos are different: they are
encrypted on the device before they go anywhere, with a key that only exists wrapped by **a six-digit code you
choose** (Settings → Photos). Six digits alone would be guessable by a machine holding a copy of the database, so
unwrapping also needs a value only the app's server can compute, and the server answers ten tries an hour, thirty a
day (`src/lib/server/vault.ts`). You type the code once on each device. If you forget it, change it from a device
that is still unlocked (Settings → Photos → Change code); if no device is unlocked, the photos can't be recovered.
The server's part depends on `CLAUDE_API_SECRET` (or `VAULT_SECRET` if set), which never leaves the server: the
connector link carries a separate token made from it. **Before ever changing `CLAUDE_API_SECRET`, add
`VAULT_SECRET` with its old value**, or devices not yet unlocked will never unlock.
Code: `src/lib/hub/vault.ts` (keys) and `src/lib/hub/photos.ts` (pictures).

## Claude

The app is also a connector for claude.ai, so Claude can read the day (lessons and what was said, study time,
habits, to-dos, grades, exams) and write back lesson notes, a rating for the day, grades, study time, exams and
to-dos. It can never see the photos, the journal or voice notes. Set-up and the tool list: [`docs/CLAUDE_CONNECTOR.md`](docs/CLAUDE_CONNECTOR.md).

## Where things are kept

The habits are exactly where Locked In kept them (`settings`, `days`, `voice`, `edits`). Everything new is one
small tree at `hub` (shape: `src/lib/hub/types.ts`), and the encrypted photos are at `body/<id>`. Habit stats count
from **15 November 2026** (`settings.startDate`).

Test without touching real data: `NEXT_PUBLIC_DATA_KEY=test-hugo npx next dev --port 3115`, then
`curl -X DELETE "<database url>/spaces/test-hugo.json"`.

---

## 1. Run it locally

You need Node.js 20 or newer (`node --version`).

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without Firebase configured the app runs in **local-only mode**
(data is saved in the browser on that device). That's fine for trying it out.

Production build check:

```bash
npm run build && npm start
```

---

## 2. Set up sync (Firebase Realtime Database, free)

1. Go to https://console.firebase.google.com → **Add project** (any name, e.g. `locked-in`).
   You can turn Google Analytics off.
2. In the left menu: **Build → Realtime Database → Create database**.
   Pick a location close to you (e.g. `europe-west1`), choose **Start in locked mode**.
3. Open the **Rules** tab and replace everything with:

   ```json
   {
     "rules": {
       "spaces": {
         "$key": {
           ".read": true,
           ".write": true
         }
       }
     }
   }
   ```

   Click **Publish**. This allows reading/writing only *under* a specific key, and nobody can list the keys,
   so your data is only reachable by someone who knows both the database URL and your private key.
4. Copy the database URL shown at the top of the Data tab. It looks like
   `https://locked-in-xxxxx-default-rtdb.europe-west1.firebasedatabase.app`.
5. Make a private key for your data path, e.g. run in a terminal:

   ```bash
   openssl rand -hex 16
   ```

6. Create a file called `.env.local` in the project folder (copy `.env.example`) and fill in:

   ```
   NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://...firebasedatabase.app
   NEXT_PUBLIC_DATA_KEY=<the random hex from step 5>
   ```

   Restart `npm run dev`. The Settings screen should now say **Synced with the cloud**.

> No auth is used on purpose. The deployed URL plus the random key is the whole privacy boundary.
> Don't share the Vercel URL, and keep `.env.local` out of git (it already is).

---

## 3. Deploy to Vercel (free)

1. Push the project to a **private** GitHub repository:

   ```bash
   git add -A && git commit -m "Locked In"
   ```

   Then create a private repo on GitHub and push (`git remote add origin … && git push -u origin main`).
2. Go to https://vercel.com → **Add New → Project** → import that repo. Framework is detected as Next.js; leave the defaults.
3. Before clicking Deploy, open **Environment Variables** and add:

   | Name                                | Value                              |
   | ----------------------------------- | ---------------------------------- |
   | `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | your database URL                  |
   | `NEXT_PUBLIC_DATA_KEY`              | the same random key as `.env.local`|
   | `CLAUDE_API_SECRET`                 | the server-only secret from `.env.local` (for the nightly task) |

   (`NEXT_PUBLIC_FIREBASE_API_KEY` and `NEXT_PUBLIC_FIREBASE_PROJECT_ID` are optional and not needed.)
4. Click **Deploy**. You get a URL like `https://locked-in-xxxx.vercel.app`.
5. Later changes: just `git push` and Vercel redeploys. If you ever change an environment variable,
   redeploy from the Vercel dashboard (Deployments → ⋯ → Redeploy) so the new value is baked in.

---

## 4. Add it to your home screen

**iPhone or iPad (Chrome or Safari)**

1. Open the Vercel URL.
2. Tap the **Share** button (square with an arrow: in the address bar on iPhone, top right on iPad) → **Add to Home Screen** → **Add**.
3. Launch it from the home screen: it opens full screen with no browser bars.

If an older Locked In icon is already there, press and hold it → **Remove App**, then add it again so the new icon shows.

---

## The Claude API

Server-only routes under `/api/claude/*`, protected by `Authorization: Bearer <CLAUDE_API_SECRET>` (a
server-only environment variable; never `NEXT_PUBLIC_`). Missing or wrong secret → 401.

| Route | What |
| --- | --- |
| `GET /api/claude/day?date=YYYY-MM-DD[&format=markdown]` | submitted?, habit/to-do counts, academic journal, the day's questions + answers + feedback, task memory |
| `GET /api/claude/range?from=…&to=…[&format=markdown]` | the same for every day in the range (max 31) |
| `POST /api/claude/update` | `questions`, `feedback`, `gradeEstimates`, `studyHours`, `econ`, `memory` (zod-validated; keyed by date/subject, so re-posting overwrites) |

Reads copy an explicit allow-list of fields; the personal journal is never returned in any form.
The full nightly prompt and setup steps are in `docs/NIGHTLY_CLAUDE_TASK.md`.

## Data model

Stored at `spaces/<DATA_KEY>` in the Realtime Database (also cached in `localStorage`, with an offline outbox):

```jsonc
{
  "settings": {
    "habits": [ { "id": "sc-nogoon", "name": "No gooning", "sound": "bell", "editId": "48f6kx3ymcg9" }, … ],  // always fifteen, in your order
    "soundsOn": true,
    "startDate": "2026-11-15",
    "v3": true, "v4": true, "v5": true, "v6": true,  // one-time upgrades (v5: four extra habits; v6: restart on the 15th, a 15th habit)
    "habitsArchive": [ … ]            // the habit list from before the minimalist switch
  },
  "days": {
    "2026-11-14": {
      "habits": [ { "id": "sc-nogoon", "name": "No gooning", "done": true }, … ],
      "submitted": { "at": 1794555089434, "pct": 90, "tier": "t80", "keystoneMissed": false },
      "voice": { "bbkowifin3vi": { "at": 1794600230238, "dur": 94, "bytes": 571234, "chunks": 2, "mime": "audio/mp4" } }
    }
  },
  "voice": { "2026-11-14": { "bbkowifin3vi": [ "<base64 piece>", … ] } },   // journal audio, fetched only to play
  "editBank": { "48f6kx3ymcg9": { "name": "No goon", "dur": 13, "bytes": 1899448, "chunks": 5, "mime": "video/mp4", "thumb": "data:image/jpeg;base64,…" } },
  "edits": { "48f6kx3ymcg9": [ "<base64 piece>", … ] }
}
```

Audio and video are cut into 384 KB pieces and stored as base64 through the REST API (`src/lib/media.ts`). Each device
keeps copies in IndexedDB; a journal recording is saved there first and uploads in the background, so one made
offline is never lost. Today and future days follow the current habit list; past days keep the habits they were saved
with. Light/dark is stored per device in `localStorage`.

## Project layout

```
src/app/            layout (Geist fonts, theme boot), page, manifest, globals.css (the grey palette, light + dark), icons
src/components/     AppShell (bottom icons), HabitsView, HabitList, JournalSheet, VoiceEntries, EditPlayer,
                    CalendarView, StatsView, SettingsView, HabitSheet, Icons
src/lib/            store (state, sync, outbox, one-time upgrades, journal upload queue), model, stats, dates,
                    defaults (the ten, start date), sounds (fourteen synthesised habit sounds), media (pieces, IndexedDB),
                    voice, edits, theme, firebase
src/lib/server/     claude.ts: the nightly-task API (still there; nothing in the app shows its output now)
public/             sw.js (offline shell), icons (regenerate with `node scripts/gen-icons.mjs`), photos, media
```

## WHOOP

Settings → WHOOP connects a WHOOP through its official API (`src/lib/server/whoop.ts`, routes under `/api/whoop`).
WHOOP only gives data to an app registered in the owner's own WHOOP account (developer-dashboard.whoop.com): its
Client ID and Client Secret are typed into Settings once and kept, encrypted, on the server side of the database
(or set as `WHOOP_CLIENT_ID` / `WHOOP_CLIENT_SECRET`). The redirect URL to register is `<site>/api/whoop/callback`.
Recovery, sleep and strain land at `hub/whoop/<date>`; they show in Health, on the morning card, and to Claude in
`get_day`.

## Morning card

The first time the app is opened each day (from 04:00) it shows yesterday's rating, last night's sleep and recovery,
today's weather (Open-Meteo, asked for central Bristol only) and today's lessons (`src/components/Morning.tsx`).
