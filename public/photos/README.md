# Your photos go here

Drop your own images into this folder, commit and push, and the app picks them up automatically.

## Today's banner (changes with the seasons)

The banner uses the first of these that exists:

1. `public/photos/months/<month>.jpg`: just for that month. Names: `jan`, `feb`, `mar`, `apr`, `may`, `jun`,
   `jul`, `aug`, `sep`, `oct`, `nov`, `dec` (e.g. `months/dec.jpg` for Christmas).
2. `public/photos/seasons/<season>.jpg`: for the whole season. Names: `spring` (Mar–May), `summer` (Jun–Aug),
   `autumn` (Sep–Nov), `winter` (Dec–Feb).
3. `public/photos/hero.jpg`: all year, when there's nothing more specific.

Landscape works best (about 3:1, the banner is wide and short). The colours of the whole app switch with the
season on their own; Settings → Season lets you preview one.

## Avatar

`public/photos/profile.jpg`: the small round photo next to the greeting (square).

Use `.jpg` and keep each under ~1 MB so the app stays quick on mobile. Until a file exists, a soft placeholder in
the season's colours is shown.

Photos for individual days are different: add those from inside the app (Calendar → camera on today).
They're stored in your Firebase database, not in this folder.
