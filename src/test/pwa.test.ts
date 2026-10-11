import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

/** PNG width/height live at fixed offsets in the IHDR chunk. */
function pngSize(p: string): { w: number; h: number } {
  const buf = readFileSync(resolve(root, p));
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

describe('PWA configuration', () => {
  const config = read('vite.config.ts');

  it('declares the required manifest fields', () => {
    expect(config).toMatch(/name: 'NutriLedger'/);
    expect(config).toMatch(/short_name: 'NutriLedger'/);
    expect(config).toMatch(/display: 'standalone'/);
    expect(config).toMatch(/theme_color: '#245B43'/);
    expect(config).toMatch(/background_color: '#F7F7F2'/);
    expect(config).toMatch(/purpose: 'maskable'/);
  });

  it('ships icons that exist with the declared sizes', () => {
    expect(pngSize('public/icons/icon-192.png')).toEqual({ w: 192, h: 192 });
    expect(pngSize('public/icons/icon-512.png')).toEqual({ w: 512, h: 512 });
    expect(pngSize('public/icons/icon-maskable-512.png')).toEqual({ w: 512, h: 512 });
    expect(existsSync(resolve(root, 'public/icons/apple-touch-icon-180.png'))).toBe(true);
    expect(existsSync(resolve(root, 'public/favicon.svg'))).toBe(true);
  });

  it('uses prompt-based updates and never caches Gemini requests', () => {
    expect(config).toMatch(/registerType: 'prompt'/);
    expect(config).toMatch(/skipWaiting: false/);
    expect(config).toMatch(/runtimeCaching: \[\]/);
    expect(config).not.toMatch(/generativelanguage/);
  });

  it('configures SPA fallback on Vercel and a CSP that only allows the Gemini API', () => {
    const vercel = JSON.parse(read('vercel.json')) as { rewrites: Array<{ destination: string }>; headers: Array<{ headers: Array<{ key: string; value: string }> }> };
    expect(vercel.rewrites.some((r) => r.destination === '/index.html')).toBe(true);
    const csp = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
    expect(csp).toMatch(/connect-src 'self' https:\/\/generativelanguage\.googleapis\.com/);
    expect(csp).toMatch(/script-src 'self'(;|\s|$)/);
    expect(csp).not.toMatch(/unsafe-eval/);
  });

  it('index.html loads the theme script externally (CSP-safe) and has a theme-color', () => {
    const html = read('index.html');
    expect(html).toMatch(/<script src="\/theme-init.js"><\/script>/);
    expect(html).toMatch(/name="theme-color"/);
    expect(html).not.toMatch(/<script>[^<]+<\/script>/);
  });
});
