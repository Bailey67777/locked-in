// The Hugo mark: a plain H, white on near-black. Used by gen-icons.mjs for every app icon.
export function logoSvg({ size = 512, padding = 0, rounded = true } = {}) {
  const s = size;
  const rx = rounded && !padding ? Math.round(s * 0.22) : 0;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${(rx * 512) / s}" fill="#0b0b0b"/>
  <path d="M180 150v212M332 150v212M180 256h152" fill="none" stroke="#f2f2f2" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}
