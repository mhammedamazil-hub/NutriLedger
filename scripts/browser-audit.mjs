#!/usr/bin/env node
/**
 * Real-browser audit for NutriLedger (responsive layout, touch targets,
 * clipped text, console errors, axe-core accessibility in light + dark).
 *
 * Not part of `npm test`: it needs a Chromium binary, which is not a project
 * dependency. Usage (from a directory where the tools are installed):
 *
 *   npm i --no-save puppeteer-core axe-core
 *   npm run build && npm run preview -- --port 4173 &
 *   CHROME_PATH=/path/to/chrome node scripts/browser-audit.mjs
 *
 * Env:
 *   CHROME_PATH        Chromium/Chrome executable (required)
 *   CHROME_LIBS        Extra LD_LIBRARY_PATH for the browser (optional)
 *   BASE_URL           Default http://localhost:4173
 *   AUDIT_OUT          Screenshot directory (default ./audit-out, git-ignored)
 *   AUDIT_WIDTHS       Comma list, default 320,360,375,390,430,768,1024,1280,1440
 *
 * Seeded records exist only inside the throwaway browser profile used for
 * the audit; they never touch real user data.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const req = createRequire(join(process.cwd(), 'noop.js'));
const puppeteer = (await import(pathToFileURL(req.resolve('puppeteer-core')).href)).default;
const axeSource = readFileSync(req.resolve('axe-core/axe.min.js'), 'utf8');

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT = process.env.AUDIT_OUT ?? 'audit-out';
const WIDTHS = (process.env.AUDIT_WIDTHS ?? '320,360,375,390,430,768,1024,1280,1440').split(',').map(Number);
const ROUTES = ['/', '/diary', '/calculator', '/progress', '/ai', '/ai?tool=photo', '/ai?tool=summary', '/settings', '/nope'];
const PROFILE = join(process.env.TMPDIR ?? '/tmp', `nl-audit-${Date.now()}`);
mkdirSync(OUT, { recursive: true });

if (!process.env.CHROME_PATH) {
  console.error('Set CHROME_PATH to a Chromium executable.');
  process.exit(2);
}

export async function launch() {
  return puppeteer.launch({
    executablePath: process.env.CHROME_PATH,
    headless: 'shell',
    userDataDir: PROFILE,
    env: { ...process.env, ...(process.env.CHROME_LIBS ? { LD_LIBRARY_PATH: process.env.CHROME_LIBS } : {}) },
    args: ['--no-sandbox', '--no-zygote', '--single-process', '--disable-gpu', '--disable-dev-shm-usage', '--font-render-hinting=none'],
    protocolTimeout: 120000,
  });
}

/** Seeds plausible records directly into the app's IndexedDB (audit profile only). */
async function seed(page) {
  await page.evaluate(async () => {
    const today = new Date();
    const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const now = new Date().toISOString();
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('nutriledger');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction(['foodEntries', 'weights', 'assessments', 'settings'], 'readwrite');
    const meals = ['breakfast', 'lunch', 'dinner', 'snacks'];
    const names = ['Overnight oats with blueberries and chia seeds', 'Chicken and avocado salad', 'Salmon, rice and broccoli', 'Greek yogurt', 'Very long food name to test wrapping behaviour across narrow phone screens without clipping'];
    for (let d = 0; d < 20; d++) {
      if (d % 4 === 3) continue; // deliberate gaps
      const date = new Date(today);
      date.setDate(today.getDate() - d);
      for (let i = 0; i < 4; i++) {
        tx.objectStore('foodEntries').put({
          id: `seed-${d}-${i}`, date: key(date), meal: meals[i], name: names[(d + i) % names.length],
          quantity: 1.5, unit: 'serving', calories: 350 + i * 120 + d * 7, protein: i === 3 ? null : 20 + i,
          carbs: 40.5, fat: i === 2 ? null : 12.25, fiber: i === 0 ? 6 : null, notes: i === 1 ? 'Homemade' : '',
          source: i === 3 ? 'ai-estimate' : 'manual', createdAt: now, updatedAt: now,
        });
      }
    }
    for (let d = 0; d < 30; d += 5) {
      const date = new Date(today);
      date.setDate(today.getDate() - d);
      tx.objectStore('weights').put({ id: `seed-w${d}`, date: key(date), weightKg: 82 - d * 0.1, note: d === 0 ? 'Morning' : '', createdAt: now, updatedAt: now });
    }
    tx.objectStore('assessments').put({
      id: 'seed-a1', date: key(today),
      inputs: { age: 34, sex: 'male', heightCm: 178, weightKg: 82, activity: 'moderate', neckCm: 39, waistCm: 90, hipCm: null },
      results: { equation: 'mifflin-st-jeor', bmr: 1757.5, activityMultiplier: 1.55, tdee: 2724.1, bodyFatPercent: 19.6, leanMassKg: 65.9, katchMcArdleBmr: 1793.8, katchMcArdleTdee: 2780.4 },
      notes: 'Baseline', createdAt: now,
    });
    tx.objectStore('settings').put({ key: 'profile', value: { age: 34, sex: 'male', heightCm: 178, weightKg: 82, activity: 'moderate', neckCm: 39, waistCm: 90, hipCm: null, updatedAt: now } });
    tx.objectStore('settings').put({ key: 'targets', value: { calories: 2400, calorieSource: 'manual', protein: 140, carbs: 250, fat: 80, updatedAt: now } });
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  });
}

/** Layout checks executed inside the page. */
function layoutProbe(minTarget) {
  const vw = document.documentElement.clientWidth;
  const srOnly = (el) => !!el.closest('.visually-hidden, .skip-link');
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
    }
    return false;
  };
  const describe = (el) => {
    const label = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40) || el.getAttribute('name') || '';
    return `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} "${label}"`;
  };
  const overflowers = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || inScroller(el) || srOnly(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) overflowers.push(`${describe(el)} [${Math.round(r.left)}–${Math.round(r.right)}]`);
  }
  const small = [];
  const targets = document.querySelectorAll('a[href], button, select, textarea, input:not([type=hidden]), summary, [role=button], [tabindex]:not([tabindex="-1"])');
  for (const el of targets) {
    if (!visible(el)) continue;
    if (srOnly(el)) continue;
    let r = el.getBoundingClientRect();
    if ((el.type === 'radio' || el.type === 'checkbox') && el.labels?.[0]) r = el.labels[0].getBoundingClientRect();
    if (r.width <= 2 && r.height <= 2) continue; // visually hidden inputs (label is the target)
    // WCAG 2.5.8 inline exception: a link that sits inside a sentence.
    const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline' && [...(el.parentElement?.childNodes ?? [])].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (inline) continue;
    if (r.width < minTarget || r.height < minTarget) small.push(`${describe(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  const clipped = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || !el.childNodes.length || srOnly(el)) continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!hasText) continue;
    const s = getComputedStyle(el);
    if ((s.overflowX === 'hidden' || s.overflowX === 'clip' || s.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1) clipped.push(describe(el));
  }
  // Content hidden under the fixed bottom navigation when scrolled to the end.
  const nav = [...document.querySelectorAll('nav[aria-label="Main"]')].find((n) => getComputedStyle(n).position === 'fixed' && visible(n));
  let coveredByNav = null;
  if (nav) {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const navTop = nav.getBoundingClientRect().top;
    const main = document.querySelector('main');
    const inFlow = (e) => visible(e) && !srOnly(e) && !['absolute', 'fixed'].includes(getComputedStyle(e).position) && !e.closest('[inert], dialog') && !(e.closest('details:not([open])') && !e.closest('summary'));
    const last = main ? [...main.querySelectorAll('*')].filter(inFlow).map((e) => e.getBoundingClientRect().bottom) : [];
    const maxBottom = Math.max(0, ...last);
    if (maxBottom > navTop + 1) coveredByNav = `content bottom ${Math.round(maxBottom)} > nav top ${Math.round(navTop)}`;
    window.scrollTo(0, 0);
  }
  return {
    pageOverflow: document.documentElement.scrollWidth > vw ? `${document.documentElement.scrollWidth} > ${vw}` : null,
    overflowers: overflowers.slice(0, 8),
    small: [...new Set(small)].slice(0, 25),
    clipped: [...new Set(clipped)].slice(0, 10),
    coveredByNav,
    h1: document.querySelector('h1')?.textContent ?? null,
  };
}

async function runAxe(page) {
  await page.evaluate(axeSource);
  return page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map((n) => n.target.join(' ') + (n.any[0]?.message ? ` — ${n.any[0].message}` : '')) }));
  });
}

async function main() {
  const browser = await launch();
  const page = await browser.newPage();
  const consoleIssues = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn' || m.type() === 'warning') consoleIssues.push(`[${page.url()}] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => consoleIssues.push(`[${page.url()}] pageerror: ${e.message}`));
  const report = { layout: [], axe: [], console: consoleIssues };

  for (const state of ['empty', 'seeded']) {
    if (state === 'seeded') {
      await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
      await seed(page);
    }
    for (const theme of ['light', 'dark']) {
      await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
      await page.evaluate((t) => localStorage.setItem('nutriledger.preferences.v1', JSON.stringify({ theme: t, units: 'metric' })), theme);
      for (const route of ROUTES) {
        for (const width of WIDTHS) {
          const touch = width < 1280; // phones and tablets
          // Puppeteer reloads the page when isMobile/hasTouch change, so switch on a blank page first.
          await page.goto('about:blank');
          await page.setViewport({ width, height: width < 768 ? 800 : 900, isMobile: width < 768, hasTouch: touch });
          await page.goto(BASE + route, { waitUntil: 'networkidle0' });
          await page.waitForSelector('h1', { timeout: 15000 });
          await new Promise((r) => setTimeout(r, 150));
          const probe = await page.evaluate(layoutProbe, touch ? 44 : 24);
          const issues = Object.entries(probe).filter(([k, v]) => k !== 'h1' && v && (!Array.isArray(v) || v.length));
          if (issues.length) report.layout.push({ state, theme, route, width, ...Object.fromEntries(issues) });
          if (theme === 'light' && (width === 375 || width === 1280)) {
            await page.screenshot({ path: join(OUT, `${state}-${route.replace(/[/?=]/g, '_') || 'root'}-${width}.png`), fullPage: true });
          }
          if (width === 375 || width === 1280) {
            const v = await runAxe(page);
            if (v.length) report.axe.push({ state, theme, route, width, violations: v });
          }
        }
      }
    }
  }
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`layout findings: ${report.layout.length}, axe pages with violations: ${report.axe.length}, console issues: ${consoleIssues.length}`);
  await browser.close();
  rmSync(PROFILE, { recursive: true, force: true });
}

await main();
