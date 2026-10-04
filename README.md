# Locked In

A personal daily habit tracker and journal, built as an installable web app (PWA).
One user, two devices, no login. Next.js + React + Tailwind, synced through a Firebase Realtime Database.

**What's in it** (five tabs: Today · Study · Health · Calendar · Settings)

- **Today** – greeting and day streak, seasonal banner photo, progress ring (habits + to-dos), core habits (emoji,
  colour, time, sound, must-do), to-do list, the **study log** (time per A-level plus what you did, marks included;
  Claude reads it), the **journal**, the three 1–10 ratings, live **countdowns** (first exam + anything added in
  Settings), a **throwback** journal entry, and **Submit day** (locks the ticks and logs the percentage; no
  punishment. A day of 80%+ with every ⭐ must-do ticked plays the reward video).
- **Study** – Claude's grade trajectory (U–A*, one line per A-level, dashed trend to the exam, tap a point for the reason),
  weekly study hours from your study log, and the Economics concept of the day plus reading (Claude's version when it has written
  one, otherwise the built-in cards and live BBC / Guardian headlines).
- **Health** – streaks, submitted-day tiers, insights, ratings chart, per-habit stats, habit heatmap. Health only.
- **Calendar** – month view; a camera on today's cell adds today's photo, past days show theirs or stay plain blue.
  Tap any day to open its full record.
- **Settings** – habits, sounds, first exam date, countdowns, season, Claude sync status, reminders, video, photos, sync.
- **Seasons** – the palette and banner switch with the seasons in Bristol (spring Mar–May, summer Jun–Aug, autumn
  Sep–Nov, winter Dec–Feb). Settings → Season previews one on that device.

Old Plan and Countdowns data is kept in the database but no longer shown.

Works offline for viewing; edits made offline are pushed when you reconnect (as long as the app stays open).

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

## 4. Add it to your phone's home screen

**iPhone (Safari)**

1. Open the Vercel URL in **Safari** (it has to be Safari, not Chrome).
2. Tap the **Share** button (square with an arrow) → **Add to Home Screen** → **Add**.
3. Launch it from the home screen: it opens full-screen with no browser bars.

**Android (Chrome)**

1. Open the URL in Chrome.
2. Tap the **⋮** menu → **Add to Home screen** (or **Install app**) → **Install**.

**Laptop**

Bookmark the URL, or in Chrome/Edge click the install icon in the address bar to get a standalone window.

---

## 5. Your own photos

Drop files here (then commit + push so Vercel picks them up):

| File                          | Shows as                                         |
| ----------------------------- | ------------------------------------------------ |
| `public/photos/months/oct.jpg` (`jan` … `dec`) | Today's banner for that month only (landscape, ~3:1) |
| `public/photos/seasons/autumn.jpg` (`spring`, `summer`, `autumn`, `winter`) | Today's banner for that season |
| `public/photos/hero.jpg`      | the banner when there's no month or season photo |
| `public/photos/profile.jpg`   | round avatar next to the greeting (square)       |

The banner uses the first file that exists: month, then season, then `hero.jpg`.

Until a file exists a wave placeholder is shown. Keep them under ~1 MB for a quick load on mobile.

**Per-day photos** are added inside the app (open any day → *Photo of the day*). They're resized in the browser
(a 96px thumbnail for the calendar, a 720px version for the day view) and stored in Firebase, so they show on both devices.

---

## Reward video

Submitting a day never punishes you: it locks the ticks and logs the percentage. If the day is **80% or more with
every ⭐ must-do ticked**, the reward video plays: `public/media/day-80-100.mp4` (`.mov`, `.m4v`, `.webm` also work;
GitHub's website caps uploads at 25 MB). Close it whenever you like. If it can't load, it plays next time the app opens.

## Reminders

Web push can't reach an iPhone unless the site is installed from Safari, so there are three routes (Settings → Reminders):

1. **ntfy** (real phone push): install the free ntfy app, subscribe to the random topic the app shows you, switch it on.
   Each time Locked In is opened it schedules the rest of that day's reminders using ntfy's delayed delivery, so nothing
   needs to be running later. Habit names pass through ntfy.sh, so the topic is random and acts like a password.
2. **Browser notifications** while a Locked In tab is open (laptop / Android).
3. **Calendar file**: download an `.ics` of daily repeating alarms and add it to the phone's Calendar.

## Privacy: the journal

The journal is plain text, like everything else in the database, so anyone with the site URL and data key can read
it. It is never sent to Claude: the API routes copy an allow-list of fields and the journal isn't on it.

Entries written back when the journal had a passphrase are stored encrypted (`journalEnc`). The first time the app
opens on a device that remembers the old key, it converts them to plain text and deletes the passphrase data in one
write. On a device that doesn't, the Journal card asks for the old passphrase once. Encryption code lives in
`src/lib/crypto.ts` only for that conversion.

## The Claude API

Server-only routes under `/api/claude/*`, protected by `Authorization: Bearer <CLAUDE_API_SECRET>` (a
server-only environment variable; never `NEXT_PUBLIC_`). Missing or wrong secret → 401.

| Route | What |
| --- | --- |
| `GET /api/claude/day?date=YYYY-MM-DD[&format=markdown]` | submitted?, habit/to-do counts, academic journal, the day's questions + answers + feedback, task memory |
| `GET /api/claude/range?from=…&to=…[&format=markdown]` | the same for every day in the range (max 31) |
| `POST /api/claude/update` | `questions`, `feedback`, `gradeEstimates`, `studyHours`, `econ`, `memory` (zod-validated; keyed by date/subject, so re-posting overwrites) |

A day now includes its **study log** (minutes + note per subject); that is what grade estimates are based on.

Reads copy an explicit allow-list of fields; the personal journal is never returned in any form.
The full nightly prompt and setup steps are in `docs/NIGHTLY_CLAUDE_TASK.md`.

## Data model

Stored at `spaces/<DATA_KEY>` in the Realtime Database (days + settings are also mirrored to `localStorage`):

```jsonc
{
  "settings": { "name": "Hugo", "examDate": "2028-05-15", "habits": [ { "id": "…", "name": "…", "emoji": "🌅", "color": "#…", "time": "06:50", "sound": "chime", "keystone": true } ], … },
  "journalCrypto": { … },   // only until old passphrase entries are converted, then deleted
  "days": {
    "2026-09-25": {
      "habits": [ … ], "todos": [ … ], "ratings": { "day": 7, "health": 8, "happy": 6 },
      "journal": "…",                                             // personal journal (plain text)
      "studyLog": { "maths": { "mins": 90, "note": "Paper 1 2019, 58/80" } },
      "academic": { "econ": "…", "maths": "…", "physics": "…" },  // active recall, plaintext
      "answers": { "maths": "…", "physics": "…", "econ": "…" },   // answers to that day's questions
      "song": "…", "screenMinutes": 185, "thumb": "data:image/jpeg;base64,…",
      "submitted": { "at": 1789286956869, "pct": 86, "tier": "t80", "keystoneMissed": false }
    }
  },
  "study": {
    "questions": { "2026-09-26": { "maths": { "topic": "…", "question": "…", "why": "…" }, … } },
    "feedback":  { "2026-09-25": { "maths": { "mark": "2/3", "comment": "…", "correctAnswer": "…" } } },
    "grades":    { "maths": { "2026-09-25": { "grade": 4.4, "reason": "…" } }, "further": {}, "physics": {}, "econ": {} },
    "hours":     { "2026-09-21": { "maths": 4.5, "physics": 3 } },
    "econ":      { "2026-09-26": { "concept": { "title": "…", "explanation": "…" }, "reading": [ … ] } },
    "memory":    { "text": "…" },
    "sync":      { "lastRead": …, "lastWrite": … }
  },
  "photos": { "2026-09-25": { "data": "data:image/jpeg;base64,…" } }   // 720px versions, loaded on demand
}
```

Today and future days always follow the current habit list (with ticks preserved by id); past days keep
the snapshot they were saved with, so editing the habit list never rewrites history. Habits with a time are
kept in time order automatically.

Sounds are synthesised in the browser with the Web Audio API (`src/lib/sounds.ts`): fifty of them, 2–5 seconds
each, no audio files to host, works offline. Each is rendered offline, measured, normalised to the same loudness and
soft-limited, so they all play at one (boosted) volume. New habits get a random one, biased towards sounds whose `tags`
match words in the habit name (e.g. "sleep" → snore, "basketball" → bouncy ball). Add a new one by appending to
the `SOUNDS` array; the 🎲 button in Settings picks a random one.

## Project layout

```
src/app/            layout, page, manifest, global styles, icons
src/components/     AppShell (tabs), TodayView, DayEditor, StudyLogCard, CalendarView, TrendsView, SettingsView, …
src/lib/            types, dates, model (normalise days/study, tiers, reward rule), season (palettes + banners), crypto (old journal conversion), stats, sounds, images, daily (econ cards), reminders, store (state, outbox), firebase
src/lib/server/     claude.ts: auth, allow-listed reads, zod-validated writes for the nightly task
src/app/api/        econ-news (headlines proxy), claude/day, claude/range, claude/update
public/media/       your submit-day videos
public/sw.js        service worker (offline app shell)
public/icons/       PWA icons (regenerate with `node scripts/gen-icons.mjs`)
public/photos/      your photos
```
