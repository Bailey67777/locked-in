// Generates the PWA icons from the logo SVG. Run: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { logoSvg } from "./logo.mjs";

mkdirSync("public/icons", { recursive: true });
const base = Buffer.from(logoSvg());
const maskable = Buffer.from(logoSvg({ padding: 0, rounded: false }));

await sharp(base).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(base).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(maskable).resize(512, 512).png().toFile("public/icons/maskable-512.png");
await sharp(base).resize(180, 180).png().toFile("src/app/apple-icon.png");
await sharp(base).resize(64, 64).png().toFile("src/app/icon.png");
writeFileSync("public/icons/icon.svg", logoSvg());
console.log("icons written");
