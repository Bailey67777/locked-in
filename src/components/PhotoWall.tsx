"use client";

import Photo from "./Photo";

const SLOTS = [
  { src: "/photos/wall-1.jpg", rotate: "-rotate-2", caption: "" },
  { src: "/photos/wall-2.jpg", rotate: "rotate-1", caption: "" },
  { src: "/photos/wall-3.jpg", rotate: "-rotate-1", caption: "" },
  { src: "/photos/wall-4.jpg", rotate: "rotate-2", caption: "" },
];

/** Laptop-only side column: a stack of your own photos. Drop files at public/photos/wall-1.jpg … wall-4.jpg. */
export default function PhotoWall() {
  return (
    <aside className="flex flex-col gap-5">
      <div className="px-1">
        <div className="label">Your wall</div>
        <p className="mt-1 text-xs font-semibold text-ink-muted">People, places, the court, the sea. Whatever this year is for.</p>
      </div>
      {SLOTS.map((s) => (
        <div key={s.src} className={`rounded-2xl bg-white p-2 pb-3 shadow-soft ${s.rotate}`}>
          <Photo src={s.src} alt="Wall photo" variant="wall" className="aspect-[4/3] w-full" />
        </div>
      ))}
    </aside>
  );
}
