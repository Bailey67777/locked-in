// The Locked In mark: a ticked circle, white on near-black. Used by gen-icons.mjs for every app icon.
export function logoSvg({ size = 512, padding = 0, rounded = true } = {}) {
  const s = size;
  const rx = rounded && !padding ? Math.round(s * 0.22) : 0;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${(rx * 512) / s}" fill="#0b0b0b"/>
  <circle cx="256" cy="256" r="132" fill="none" stroke="#f2f2f2" stroke-width="22"/>
  <path d="M196 260 l42 42 l82 -92" fill="none" stroke="#f2f2f2" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}
