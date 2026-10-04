import { readdirSync } from "node:fs";
import path from "node:path";
import AppShell from "@/components/AppShell";
import { SEASONS, type SeasonPhotos } from "@/lib/season";

const IMAGE = /\.(jpe?g|png|webp|avif)$/i;

/** Lists public/photos/<season>/ at build time, so dropping a photo into a folder (and pushing) is all it takes. */
function seasonPhotos(): SeasonPhotos {
  const out = { spring: [], summer: [], autumn: [], winter: [] } as SeasonPhotos;
  for (const s of SEASONS) {
    try {
      out[s] = readdirSync(path.join(process.cwd(), "public", "photos", s))
        .filter((f) => IMAGE.test(f))
        .sort()
        .map((f) => `/photos/${s}/${encodeURIComponent(f)}`);
    } catch {
      /* folder missing: no photos for that season */
    }
  }
  return out;
}

export default function Home() {
  return <AppShell seasonPhotos={seasonPhotos()} />;
}
