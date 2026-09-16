// The Locked In logo: sun, grass, a stick figure standing on the grass next to a lake.
// Used by gen-icons.mjs (PNG icons) and mirrored in src/components/Icons.tsx (inline SVG).
export function logoSvg({ size = 512, padding = 0, rounded = true } = {}) {
  const s = size;
  const p = padding;
  const inner = s - 2 * p;
  const rx = rounded && !p ? Math.round(s * 0.22) : 0;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#bfe3f7"/>
      <stop offset="0.7" stop-color="#e9f3fa"/>
      <stop offset="1" stop-color="#f6ead2"/>
    </linearGradient>
    <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4aa7dc"/>
      <stop offset="1" stop-color="#1a6fd1"/>
    </linearGradient>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7cc242"/>
      <stop offset="1" stop-color="#4e9a2a"/>
    </linearGradient>
    <clipPath id="clip"><rect x="${p}" y="${p}" width="${inner}" height="${inner}" rx="${rx}"/></clipPath>
  </defs>
  <g clip-path="url(#clip)">
    <rect x="${p}" y="${p}" width="${inner}" height="${inner}" fill="url(#sky)"/>
    <!-- sun with rays -->
    <g stroke="#f6a623" stroke-width="14" stroke-linecap="round">
      <line x1="128" y1="40" x2="128" y2="10"/><line x1="128" y1="246" x2="128" y2="216"/>
      <line x1="25" y1="128" x2="-5" y2="128"/><line x1="231" y1="128" x2="261" y2="128"/>
      <line x1="55" y1="55" x2="34" y2="34"/><line x1="201" y1="201" x2="222" y2="222"/>
      <line x1="55" y1="201" x2="34" y2="222"/><line x1="201" y1="55" x2="222" y2="34"/>
    </g>
    <circle cx="128" cy="128" r="70" fill="#ffd54a" stroke="#f6a623" stroke-width="10"/>
    <!-- hills -->
    <ellipse cx="420" cy="330" rx="260" ry="90" fill="#9ad06a"/>
    <!-- grass -->
    <path d="M0 340 C 90 318, 180 318, 270 340 S 440 362, 512 340 L512 512 L0 512 Z" fill="url(#grass)"/>
    <!-- lake -->
    <ellipse cx="380" cy="415" rx="150" ry="62" fill="url(#lake)"/>
    <path d="M262 405 C 300 396, 340 396, 380 405 S 460 414, 500 405" fill="none" stroke="#dff1fb" stroke-width="7" stroke-linecap="round" opacity="0.9"/>
    <path d="M290 435 C 320 428, 350 428, 380 435 S 440 442, 470 435" fill="none" stroke="#dff1fb" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
    <!-- grass tufts -->
    <g stroke="#2f7a1b" stroke-width="6" stroke-linecap="round" fill="none">
      <path d="M40 470 l-8 -30"/><path d="M52 472 l4 -34"/><path d="M64 470 l14 -26"/>
      <path d="M470 480 l-10 -28"/><path d="M484 482 l2 -30"/>
      <path d="M212 470 l-6 -24"/><path d="M226 472 l8 -26"/>
    </g>
    <!-- stick figure on the grass, next to the lake -->
    <g stroke="#1b2a36" stroke-width="12" stroke-linecap="round" fill="none">
      <circle cx="160" cy="310" r="28" fill="#fbf7f0"/>
      <line x1="160" y1="338" x2="160" y2="420"/>
      <line x1="160" y1="360" x2="118" y2="392"/>
      <line x1="160" y1="360" x2="206" y2="330"/>
      <line x1="160" y1="420" x2="130" y2="476"/>
      <line x1="160" y1="420" x2="192" y2="476"/>
    </g>
    <!-- smile -->
    <path d="M148 316 q12 12 24 0" fill="none" stroke="#1b2a36" stroke-width="5" stroke-linecap="round"/>
    <circle cx="151" cy="304" r="3.5" fill="#1b2a36"/><circle cx="169" cy="304" r="3.5" fill="#1b2a36"/>
  </g>
</svg>`;
}
