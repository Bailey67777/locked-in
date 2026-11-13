# Locked In

A minimalist daily habit tracker, installable as a web app (PWA). One person, iPhone and iPad, no login.
Black, white and grey; ten habits; nothing else. Next.js + React + Tailwind, synced through a Firebase Realtime Database.

**Four icons at the bottom**

- **Habits** – today's ten habits, a percentage bar, and **Submit day** (locks the ticks; *Reopen* undoes it).
- **Calendar** – each day shaded from clear (nothing recorded) to solid black (100%). Tap a day to see or fix its ticks.
- **Stats** – streak (days in a row at 80%+), best streak, 7- and 30-day averages, the last 30 days, and each habit's rate.
- **Settings** – rename, time, reorder, add or remove habits (ten at most), tick sounds, light/dark, how to add it
  to the home screen, sync status.

The ten habits start from what Santa Cruz Medicinals repeats most for daily health (morning light and water, a
10-minute mobility routine, protein, 10,000 steps, lifting, real food, no gooning, screens off, an early night).
They're only a starting point: change them in Settings.

Earlier versions had a journal, to-do planner, edits, vlogs, study coach, photos and fifty sound effects. That data
is all still in the database (nothing was deleted); the app just doesn't show it. The habit list from before the
switch is kept in `settings.habitsArchive`.

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
    "habits": [ { "id": "sc-sun", "name": "Sunlight + water", "time": "07:00" }, … ],  // ten at most, in your order
    "soundsOn": true,
    "v3": true,                       // the switch to the ten habits has happened
    "habitsArchive": [ … ]            // the habit list from before that switch
  },
  "days": {
    "2026-11-13": {
      "habits": [ { "id": "sc-sun", "name": "Sunlight + water", "done": true }, … ],
      "submitted": { "at": 1794555089434, "pct": 40, "tier": "t25", "keystoneMissed": false }
      // older fields (todos, journal, ratings, vlog, …) are kept as they were
    }
  }
}
```

Today and future days follow the current habit list (ticks kept by id). Past days keep the habits they were saved
with, so changing the list never rewrites history. Light/dark is stored per device in `localStorage`.

## Project layout

```
src/app/            layout (Geist fonts, theme boot), page, manifest, globals.css (the grey palette, light + dark), icons
src/components/     AppShell (bottom icons), HabitsView, HabitList, CalendarView, StatsView, SettingsView, Icons
src/lib/            store (state, sync, outbox, one-time habit switch), model, stats, dates, defaults (the ten), sounds (three synthesised), theme, firebase
src/lib/server/     claude.ts: the nightly-task API (still there; the Study tab that showed its output is gone)
public/             sw.js (offline shell), icons (regenerate with `node scripts/gen-icons.mjs`), photos, media
```
