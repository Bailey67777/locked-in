# Locked In

A personal daily habit tracker and journal, built as an installable web app (PWA).
One user, two devices, no login. Next.js + React + Tailwind, synced through a Firebase Realtime Database.

**What's in it** (five tabs: Today · Study · Health · Calendar · Settings)

- **Today** – greeting and day streak, banner photo, progress ring (habits + to-dos), core habits (emoji, colour, time,
  sound, must-do), to-do list, song of the day, the **personal journal (end-to-end encrypted)**, the three 1–10 ratings
  and screen time, the **academic journal** (Economics / Maths / Physics, written from memory), **today's questions**
  (three set by Claude the night before, answerable offline, with yesterday's marks), the countdown to your first A-level
  exam, and **Submit day** (locks the ticks, works out the tier, plays that tier's video).
- **Study** – Claude's grade trajectory (U–A*, one line per A-level, dashed trend to the exam, tap a point for the reason),
  estimated weekly study hours, and the Economics concept of the day plus reading (Claude's version when it has written
  one, otherwise the built-in cards and live BBC / Guardian headlines).
- **Health** – streaks, submitted-day tiers, insights, ratings chart, per-habit stats, habit heatmap. Health only.
- **Calendar** – month view; a camera on today's cell adds today's photo, past days show theirs or stay plain blue.
  Tap any day to open its full record.
- **Settings** – habits, sounds, first exam date, journal passphrase, Claude sync status, reminders, videos, photos, sync.
- **Laptop** – a photo wall column beside the app on wide screens (`public/photos/wall-1.jpg` … `wall-4.jpg`).

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
| `public/photos/hero.jpg`      | banner at the top of Today (landscape, ~3:2)     |
| `public/photos/profile.jpg`   | round avatar next to the greeting (square)       |
| `public/photos/wall-1.jpg` … `wall-4.jpg` | the photo wall beside the app on a laptop (4:3) |

Until a file exists a wave placeholder is shown. Keep them under ~1 MB for a quick load on mobile.

**Per-day photos** are added inside the app (open any day → *Photo of the day*). They're resized in the browser
(a 96px thumbnail for the calendar, a 720px version for the day view) and stored in Firebase, so they show on both devices.

---

## Submit-day videos

Upload to `public/media/` on GitHub (any length; GitHub's website caps uploads at 25 MB each):

| Day result                                   | File               |
| -------------------------------------------- | ------------------ |
| 80–100%                                      | `day-80-100.mp4`   |
| 50–79%                                       | `day-50-80.mp4`    |
| 25–49% (optional, falls back to 0–25)        | `day-25-50.mp4`    |
| 0–24%, or a ⭐ must-do habit missed           | `day-0-25.mp4`     |

## Reminders

Web push can't reach an iPhone unless the site is installed from Safari, so there are three routes (Settings → Reminders):

1. **ntfy** (real phone push): install the free ntfy app, subscribe to the random topic the app shows you, switch it on.
   Each time Locked In is opened it schedules the rest of that day's reminders using ntfy's delayed delivery, so nothing
   needs to be running later. Habit names pass through ntfy.sh, so the topic is random and acts like a password.
2. **Browser notifications** while a Locked In tab is open (laptop / Android).
3. **Calendar file**: download an `.ics` of daily repeating alarms and add it to the phone's Calendar.

## Privacy: the encrypted journal

The personal journal is encrypted on your device before it is saved (`src/lib/crypto.ts`):

- Key: PBKDF2-SHA256, 600,000 iterations, random salt → AES-GCM 256, non-extractable.
- Each entry: fresh random IV. Firebase stores only `{ iv, ct }` (base64) plus the salt and a small
  encrypted verifier under `journalCrypto` so a wrong passphrase can be spotted.
- The derived key is remembered on each device in IndexedDB (never the passphrase); *Lock journal* in Settings
  clears it. Changing the passphrase re-encrypts every entry in one atomic write.
- Plaintext never goes to Firebase, `localStorage`, the API routes or logs.
- **There is no recovery.** A forgotten passphrase means the entries are gone.

Everything else (habits, ratings, academic journal, answers, photos, study data) is not encrypted, because the
nightly Claude task needs to read it and the app has no login. Anyone with the site URL can read that data.

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

Stored at `spaces/<DATA_KEY>` in the Realtime Database (days + settings are also mirrored to `localStorage`):

```jsonc
{
  "settings": { "name": "Hugo", "examDate": "2028-05-15", "habits": [ { "id": "…", "name": "…", "emoji": "🌅", "color": "#…", "time": "06:50", "sound": "chime", "keystone": true } ], … },
  "journalCrypto": { "v": 1, "salt": "…", "iterations": 600000, "verifier": { "iv": "…", "ct": "…" } },
  "days": {
    "2026-09-25": {
      "habits": [ … ], "todos": [ … ], "ratings": { "day": 7, "health": 8, "happy": 6 },
      "journalEnc": { "iv": "…", "ct": "…" },                     // personal journal, ciphertext only
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
src/components/     AppShell (tabs), TodayView, DayEditor, CalendarView, TrendsView, SettingsView, …
src/lib/            types, dates, model (normalise days/study, tiers), crypto (journal encryption), stats, sounds, images, daily (econ cards), reminders, store (state, outbox, journal key), firebase
src/lib/server/     claude.ts: auth, allow-listed reads, zod-validated writes for the nightly task
src/app/api/        econ-news (headlines proxy), claude/day, claude/range, claude/update
public/media/       your submit-day videos
public/sw.js        service worker (offline app shell)
public/icons/       PWA icons (regenerate with `node scripts/gen-icons.mjs`)
public/photos/      your photos
```
