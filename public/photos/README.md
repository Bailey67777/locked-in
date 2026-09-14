# Your photos go here

Drop your own images into this folder, commit and push, and the app picks them up automatically:

| File                          | Where it shows                                                    |
| ----------------------------- | ----------------------------------------------------------------- |
| `public/photos/hero.jpg`      | The banner at the top of the Today screen (landscape, ~3:2)       |
| `public/photos/profile.jpg`   | The small round avatar next to the greeting (square)              |
| `public/photos/wall-1.jpg`    | Photo wall, laptop only (side column), slot 1 (4:3 works best)    |
| `public/photos/wall-2.jpg`    | Photo wall slot 2                                                  |
| `public/photos/wall-3.jpg`    | Photo wall slot 3                                                  |
| `public/photos/wall-4.jpg`    | Photo wall slot 4                                                  |

Use `.jpg`. Keep each under ~1 MB so the app stays quick on mobile.
Until a file exists, a wave placeholder is shown in its place.

Photos for individual days are different: add those from inside the app (open a day → "Photo of the day").
They're stored in your Firebase database, not in this folder.
