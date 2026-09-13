# Your photos go here

Drop your own images into this folder and the app picks them up automatically:

| File                     | Where it shows                                  |
| ------------------------ | ----------------------------------------------- |
| `public/photos/hero.jpg` | The banner at the top of the Today screen       |
| `public/photos/profile.jpg` | The small round avatar next to the greeting  |

Use `.jpg` (or rename the paths in `src/components/TodayView.tsx` if you prefer `.png`).
Landscape works best for `hero.jpg` (roughly 3:2 or wider); square for `profile.jpg`.
Until a file exists, a wave placeholder is shown instead.
