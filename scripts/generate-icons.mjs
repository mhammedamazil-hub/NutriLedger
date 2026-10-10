// Generates PWA icons from the NutriLedger mark (same artwork as src/components/common/Logo.tsx).
// Usage: npm i --no-save sharp@0.34 && node scripts/generate-icons.mjs
// (sharp is intentionally not a project dependency; the generated PNGs are committed.)
// ICONS_OUT=/abs/dir overrides the output directory.
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const out = process.env.ICONS_OUT
  ? new URL(`file://${process.env.ICONS_OUT.replace(/\/?$/, '/')}`)
  : new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

const mark = (scale = 1) => {
  // Artwork drawn on a 64-unit grid, centred and optionally scaled (for the maskable safe zone).
  const t = 32 - 32 * scale;
  return `<g transform="translate(${t} ${t}) scale(${scale})">
    <path d="M17 45C17 29 28.5 17.5 47.5 16.5C47.5 34.5 36 45 17 45Z" fill="#F7F7F2"/>
    <path d="M19 43L39 23" stroke="#245B43" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M14 51.5H50" stroke="#9CCBB0" stroke-width="3" stroke-linecap="round"/>
  </g>`;
};

const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#245B43"/>${mark()}</svg>`;
// Maskable: full-bleed background; artwork inside the central 80% safe zone.
const fullBleed = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#245B43"/>${mark(scale)}</svg>`;

const jobs = [
  ['icon-192.png', rounded, 192],
  ['icon-512.png', rounded, 512],
  ['icon-maskable-512.png', fullBleed(0.72), 512],
  ['apple-touch-icon-180.png', fullBleed(0.86), 180],
];

for (const [name, svg, size] of jobs) {
  await sharp(Buffer.from(svg), { density: 72 * (size / 64) * 2 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(new URL(name, out).pathname);
  console.log(`wrote public/icons/${name} (${size}×${size})`);
}
