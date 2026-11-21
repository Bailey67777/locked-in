import type { PoseId } from "@/lib/hub/types";

/** The left half of someone standing square to the camera, arms a little out; the right half is this, mirrored. */
const HALF =
  "M141 68C141 79 138 84 128 87C113 90 103 95 100 108C96 128 93 150 90 172C88 190 85 204 83 216C81 227 88 233 93 224C97 206 102 187 105 169C108 151 110 137 112 124C113 141 115 156 115 170C114 185 112 197 112 211C112 241 116 270 120 296C118 320 122 350 126 372C122 380 115 386 117 391H140C142 381 140 375 140 370C142 344 144 318 143 296C145 266 148 236 150 215";

/**
 * What to line up with, for each of the five photos, drawn in a 300 × 400 frame. They never change, so standing
 * inside the same outline every day is what makes one day's photo sit exactly over another's.
 */
const OUTLINES: Record<PoseId, { lines: string[]; faint?: string[]; mirrored?: string }> = {
  "face-front": {
    lines: [
      "M150 66C198 66 226 104 226 154C226 208 196 276 150 276C104 276 74 208 74 154C74 104 102 66 150 66Z",
      "M112 262V300C112 324 40 322 0 366",
      "M188 262V300C188 324 260 322 300 366",
    ],
    faint: ["M92 160H208"], // eyes
  },
  "face-side": {
    lines: [
      "M112 400C128 368 136 334 132 296C120 294 104 292 96 280C88 268 90 258 92 250C86 246 84 240 88 234C82 230 80 222 86 214C76 212 64 206 62 198C68 184 84 166 90 150C88 138 90 128 94 118C102 84 134 60 172 60C222 60 258 100 258 156C258 204 240 236 226 258C222 290 232 320 252 336C272 346 290 356 300 372",
    ],
    faint: ["M204 168C186 158 176 190 194 210", "M62 160H112"], // ear, eyes
  },
  "body-front": {
    lines: ["M150 22C162 22 169 33 169 46C169 59 162 70 150 70C138 70 131 59 131 46C131 33 138 22 150 22Z"],
    mirrored: HALF,
  },
  "body-side": {
    lines: [
      "M146 22C160 22 168 33 168 46C168 60 160 70 148 70C136 70 128 60 128 47C128 33 134 22 146 22Z",
      // Front: throat, chest, stomach, thigh, shin, toes.
      "M138 68C137 78 122 86 116 102C110 118 116 140 121 160C125 176 120 190 118 208C114 236 118 268 124 296C124 322 129 348 131 372C124 379 108 382 106 390H162",
      // Back: neck, shoulders, the small of the back, seat, calf, heel.
      "M158 68C160 78 176 86 181 104C186 126 170 146 167 166C166 184 186 192 186 214C186 244 167 272 163 298C162 312 172 322 170 338C168 352 158 362 154 372C156 380 164 384 162 390",
    ],
    faint: ["M142 98C136 130 136 168 138 198C138 216 142 228 149 226C157 222 158 200 160 170C162 142 164 116 160 98"], // arm
  },
  back: {
    lines: ["M150 22C162 22 169 33 169 46C169 59 162 70 150 70C138 70 131 59 131 46C131 33 138 22 150 22Z"],
    mirrored: HALF,
  },
};

/**
 * The outline for one photo, to stand inside. Over the camera it is white with a dark edge, so it shows over any
 * room; `quiet` draws it once in the text colour, for an empty tile waiting for its photo.
 */
export default function PoseOutline({ pose, className, quiet = false }: { pose: PoseId; className?: string; quiet?: boolean }) {
  const o = OUTLINES[pose];
  const draw = (width: number, colour: string) => (
    <g fill="none" stroke={colour} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      {o.lines.map((d) => (
        <path key={d} d={d} vectorEffect="non-scaling-stroke" />
      ))}
      {o.mirrored && <path d={o.mirrored} vectorEffect="non-scaling-stroke" />}
      {o.mirrored && <path d={o.mirrored} vectorEffect="non-scaling-stroke" transform="translate(300 0) scale(-1 1)" />}
    </g>
  );
  if (quiet)
    return (
      <svg viewBox="0 0 300 400" className={className} aria-hidden="true">
        {draw(1.5, "currentColor")}
      </svg>
    );
  return (
    <svg viewBox="0 0 300 400" className={className} aria-hidden="true">
      {draw(5, "rgba(0,0,0,.28)")}
      {draw(2, "rgba(255,255,255,.9)")}
      <g fill="none" stroke="rgba(255,255,255,.7)" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="3 6">
        {o.faint?.map((d) => (
          <path key={d} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  );
}
