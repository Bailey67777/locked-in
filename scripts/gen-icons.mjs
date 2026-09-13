// Generates the PWA icons from an inline SVG (sun over waves). Run: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

function svg(padding = 0) {
  const s = 512;
  const p = padding;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fbe3c4"/>
      <stop offset="0.55" stop-color="#f6b26b"/>
      <stop offset="1" stop-color="#1a6fd1"/>
    </linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3f9bd0"/>
      <stop offset="1" stop-color="#0b2a47"/>
    </linearGradient>
  </defs>
  <rect x="${p}" y="${p}" width="${s - 2 * p}" height="${s - 2 * p}" rx="${p ? 0 : 112}" fill="url(#sky)"/>
  <circle cx="256" cy="228" r="86" fill="#fff4d6"/>
  <circle cx="256" cy="228" r="110" fill="#fff4d6" opacity="0.28"/>
  <path d="M0 300 C 64 270, 128 270, 192 300 S 320 330, 384 300 S 480 270, 512 300 L512 512 L0 512 Z" fill="url(#sea)"/>
  <path d="M0 340 C 64 310, 128 310, 192 340 S 320 370, 384 340 S 480 310, 512 340" fill="none" stroke="#fbf7f0" stroke-width="16" stroke-linecap="round" opacity="0.85"/>
  <path d="M0 400 C 64 370, 128 370, 192 400 S 320 430, 384 400 S 480 370, 512 400" fill="none" stroke="#fbf7f0" stroke-width="12" stroke-linecap="round" opacity="0.5"/>
</svg>`;
}

mkdirSync("public/icons", { recursive: true });
const base = Buffer.from(svg(0));
const maskable = Buffer.from(svg(56));

await sharp(base).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(base).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(maskable).resize(512, 512).png().toFile("public/icons/maskable-512.png");
await sharp(base).resize(180, 180).png().toFile("src/app/apple-icon.png");
await sharp(base).resize(64, 64).png().toFile("src/app/icon.png");
writeFileSync("public/icons/icon.svg", svg(0));
console.log("icons written");
