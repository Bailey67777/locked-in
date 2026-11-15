// The Hugo mark: a sun, white on near-black. Used by gen-icons.mjs for every app icon.
// A disc with a fine inner ring, twelve long rays and twelve short ones between them, each tapering to a point.
export function logoSvg({ size = 512, padding = 0, rounded = true } = {}) {
  const s = size;
  const rx = rounded && !padding ? Math.round(s * 0.22) : 0;
  const c = 256;
  const ray = (angle, from, to, half) => {
    const a = (angle * Math.PI) / 180;
    const [ux, uy] = [Math.cos(a), Math.sin(a)];
    const [px, py] = [-uy, ux];
    const p = (r, w) => `${(c + ux * r + px * w).toFixed(1)},${(c + uy * r + py * w).toFixed(1)}`;
    return `<polygon points="${p(from, half)} ${p(to, 0)} ${p(from, -half)}"/>`;
  };
  const rays = [];
  for (let i = 0; i < 12; i++) {
    rays.push(ray(i * 30 - 90, 122, 204, 15));
    rays.push(ray(i * 30 - 75, 124, 168, 9));
  }
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${(rx * 512) / s}" fill="#0b0b0b"/>
  <g fill="#f2f2f2" stroke="#f2f2f2" stroke-width="5" stroke-linejoin="round">${rays.join("")}</g>
  <circle cx="${c}" cy="${c}" r="100" fill="#f2f2f2"/>
  <circle cx="${c}" cy="${c}" r="82" fill="none" stroke="#0b0b0b" stroke-width="4"/>
</svg>`;
}
