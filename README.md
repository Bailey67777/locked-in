# Locked In

A personal daily habit tracker and journal, built as an installable web app (PWA).
One user, two devices, no login. Next.js + React + Tailwind, synced through a Firebase Realtime Database.

**What's in it**

- **Today** – greeting and day streak, banner photo, your core habits (each with its own emoji, colour, time and tick sound),
  a per-day to-do list (with "move to tomorrow"), a progress ring, three 1–10 ratings (Day / Health / Happiness),
  a photo of the day, and a mini journal. Confetti and a fanfare when every habit is ticked.
- **Calendar** – month view shaded by completion; days with a photo show it as their tile. Tap any past or future day to view and edit it.
- **Trends** – streaks, this-week-vs-last-week, plain-English insights from your own numbers, ratings line chart (7 / 30 days),
  per-habit completion bars with streaks, and a habit heatmap.
- **Settings** – rename, reorder, add or remove habits; set each one's emoji, colour, time of day and sound; toggle sounds; your name; sync status.
- **Laptop** – a photo wall column appears beside the app on wide screens (drop `wall-1.jpg` … `wall-4.jpg` into `public/photos/`).

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

## Data model

Stored at `spaces/<DATA_KEY>` in the Realtime Database (days + settings are also mirrored to `localStorage`):

```jsonc
{
  "settings": {
    "name": "Hugo",
    "soundsOn": true, "todoSound": "pop", "dayCompleteSound": "tada",
    "habits": [{ "id": "wake-outside", "name": "…", "emoji": "🌅", "color": "#ef8a3c", "time": "06:50", "sound": "chime" }]
  },
  "days": {
    "2026-09-13": {
      "date": "2026-09-13",
      "habits": [{ "id": "wake-outside", "name": "…", "done": true }],   // snapshot for that day
      "todos": [{ "id": "…", "text": "finish Physics homework", "done": false }],
      "ratings": { "day": 7, "health": 8, "happy": 6 },                   // 0 = not set
      "journal": "…",
      "thumb": "data:image/jpeg;base64,…",                                // tiny calendar thumbnail (optional)
      "updatedAt": 1789286956869
    }
  },
  "photos": { "2026-09-13": { "data": "data:image/jpeg;base64,…", "updatedAt": … } }   // 720px versions, loaded on demand
}
```

Today and future days always follow the current habit list (with ticks preserved by id); past days keep
the snapshot they were saved with, so editing the habit list never rewrites history. Habits with a time are
kept in time order automatically.

Sounds are synthesised in the browser with the Web Audio API (`src/lib/sounds.ts`), so there are no audio files
to host and they work offline. Add a new one by appending to the `SOUNDS` array.

## Project layout

```
src/app/            layout, page, manifest, global styles, icons
src/components/     AppShell (tabs), TodayView, DayEditor, CalendarView, TrendsView, SettingsView, …
src/lib/            types, dates, model (normalise/materialise days), stats (streaks, insights), sounds, images, store (state + Firebase), firebase
public/sw.js        service worker (offline app shell)
public/icons/       PWA icons (regenerate with `node scripts/gen-icons.mjs`)
public/photos/      your photos
```
