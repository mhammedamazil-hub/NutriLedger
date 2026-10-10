/**
 * Real-browser functional checks against a production build served by
 * `npm run preview` (default http://localhost:4173). Runs in headless Chromium
 * via puppeteer-core; nothing here is simulated in jsdom.
 *
 * Checks: service worker takes control; diary add survives reload; a rapid
 * repeated save creates one entry; duplicate; offline reload + offline add;
 * AI clearly unavailable offline with no Gemini traffic; an app update never
 * reloads over unsaved input without confirmation; IndexedDB survives the
 * service-worker update.
 *
 * puppeteer-core is resolved from the current working directory and is not a
 * project dependency. Usage (from a directory where puppeteer-core is installed):
 *   CHROME_PATH=/path/to/chrome [CHROME_LIBS=/extra/lib/dir] [BASE_URL=http://localhost:4173] \
 *   SW_FILE=/path/to/NutriLedger/dist/sw.js node /path/to/NutriLedger/scripts/browser-e2e.mjs
 * SW_FILE is temporarily modified (a comment is appended) to simulate a new
 * release, and restored afterwards.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(join(process.cwd(), 'package.json'));
const puppeteer = require('puppeteer-core');

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const SW_FILE = process.env.SW_FILE;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const env = { ...process.env };
if (process.env.CHROME_LIBS) env.LD_LIBRARY_PATH = `${process.env.CHROME_LIBS}:${env.LD_LIBRARY_PATH ?? ''}`;
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH,
  headless: 'shell',
  env,
  args: ['--no-sandbox', '--no-zygote', '--single-process', '--disable-gpu', '--disable-dev-shm-usage'],
});

const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push(m.text());
});
const geminiRequests = [];
page.on('request', (r) => {
  if (/generativelanguage\.googleapis\.com/.test(r.url())) geminiRequests.push(r.url());
});
let unloadPrompts = 0;
page.on('dialog', async (d) => {
  if (d.type() === 'beforeunload') {
    unloadPrompts += 1;
    if (process.env.E2E_DEBUG) console.log(`[debug] beforeunload prompt at ${page.url()} after step ${results.length}`);
  }
  await d.accept();
});

const h1 = () => page.$eval('h1', (el) => el.textContent?.trim() ?? '').catch(() => '');
const waitH1 = (text) => page.waitForFunction((t) => document.querySelector('h1')?.textContent?.trim() === t, { timeout: 20000 }, text);
const aria = (role, name) => `::-p-aria([name="${name}"][role="${role}"])`;
const countEntries = () =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('nutriledger');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const c = db.transaction('foodEntries').objectStore('foodEntries').count();
          c.onsuccess = () => {
            db.close();
            resolve(c.result);
          };
          c.onerror = () => reject(c.error);
        };
      }),
  );
const clickByText = (text) =>
  page.evaluate((t) => {
    const el = [...document.querySelectorAll('button, a')].find(
      (b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === t && !b.closest('[inert]'),
    );
    if (!el) throw new Error(`No button/link "${t}"`);
    el.click();
  }, text);
const bodyHas = (text) => page.evaluate((t) => document.body.innerText.includes(t), text);
const waitDialogClosed = () => page.waitForFunction(() => !document.querySelector('dialog[open]'), { timeout: 10000 });

async function addFood(name, calories) {
  await clickByText('Add food');
  await page.waitForSelector('dialog[open]');
  await page.locator(aria('textbox', 'Food name')).fill(name);
  await page.locator(aria('textbox', 'Calories')).fill(calories);
}

const originalSw = SW_FILE ? readFileSync(SW_FILE, 'utf8') : null;
try {
  // 1. First visit and service worker control.
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  await waitH1('Today');
  let controlled = await page
    .waitForFunction(() => !!navigator.serviceWorker?.controller, { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  check('service worker registers and controls the page', controlled);

  // 2. Add an entry with a rapid triple save (synchronous clicks in one task).
  await page.goto(`${BASE}/diary`, { waitUntil: 'networkidle0' });
  await waitH1('Food diary');
  await addFood('E2E oats', '150.5');
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('dialog[open] button')].find((b) => b.textContent?.trim() === 'Save entry');
    btn.click();
    btn.click();
    btn.click();
  });
  await waitDialogClosed();
  check('rapid repeated save creates exactly one entry', (await countEntries()) === 1, `stored=${await countEntries()}`);

  // 3. Persistence across reload.
  await page.reload({ waitUntil: 'networkidle0' });
  await waitH1('Food diary');
  check('entry persists after reload', await bodyHas('E2E oats'));
  check('decimal calories shown', await bodyHas('151') || (await bodyHas('150.5')));

  // 4. Duplicate.
  await clickByText('Duplicate E2E oats');
  await page.waitForSelector('dialog[open]');
  const dupTitle = await page.$eval('dialog[open] h2', (el) => el.textContent?.trim());
  await clickByText('Save entry');
  await waitDialogClosed();
  check('duplicate opens a review dialog and saves a copy', dupTitle === 'Duplicate food entry' && (await countEntries()) === 2, `title=${dupTitle}`);

  // 5. Offline: reload, read, write.
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const offlineLoaded = await waitH1('Food diary').then(() => true).catch(() => false);
  check('app reloads while offline (served by the service worker)', offlineLoaded, `h1=${await h1()}`);
  check('records readable offline', await bodyHas('E2E oats'));
  await addFood('Offline apple', '95');
  await clickByText('Save entry');
  await waitDialogClosed();
  check('can add an entry offline', (await countEntries()) === 3);
  await page.goto(`${BASE}/progress`, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
  check('other routes load offline (lazy chunks precached)', await waitH1('Progress').then(() => true).catch(() => false), `h1=${await h1()}`);
  // AI offline, with a (fake, session-only) key so the only blocker is connectivity.
  // Saving a key is local; no request is made unless "Test connection" is used.
  await clickByText('Settings');
  await waitH1('Settings');
  await page.locator('input[type="password"]').fill('AIzaSyFAKE-e2e-not-a-real-key-0000000000');
  await clickByText('Save key');
  await page.waitForFunction(() => document.body.innerText.includes('Remove key'), { timeout: 10000 });
  await clickByText('AI');
  await waitH1('AI nutrition assistant');
  await clickByText('Estimate from text');
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent?.includes('Estimate nutrition')), { timeout: 10000 });
  const ai = await page.evaluate(() => {
    const send = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Estimate nutrition'));
    return {
      offlineNotice: document.body.innerText.includes('You’re offline'),
      sendDisabled: !!send && (send.disabled || send.getAttribute('aria-disabled') === 'true'),
    };
  });
  check('AI is clearly unavailable offline (notice shown, sending disabled)', ai.offlineNotice && ai.sendDisabled, JSON.stringify(ai));
  await page.setOfflineMode(false);

  // 6. Update flow: simulate a new release by changing sw.js bytes.
  if (SW_FILE) {
    writeFileSync(SW_FILE, `${originalSw}\n// e2e-update-probe ${Date.now()}\n`);
    await page.goto(`${BASE}/calculator`, { waitUntil: 'networkidle0' });
    await waitH1('Energy calculator');
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()));
    const prompted = await page
      .waitForFunction(() => document.body.innerText.includes('A new version of NutriLedger is available'), { timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    check('new version is detected and announced (not auto-applied)', prompted);
    if (prompted) {
      // Unsaved calculator input.
      await page.locator(aria('textbox', 'Weight')).fill('81.5');
      await clickByText('Reload to update');
      await new Promise((r) => setTimeout(r, 1500));
      const stillHere = (await page.$eval(aria('textbox', 'Weight'), (el) => el.value).catch(() => '')) === '81.5';
      check('update does not reload over unsaved input; asks first', stillHere && (await bodyHas('Update anyway')));
      const nav = page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).then(() => true).catch(() => false);
      await clickByText('Update anyway');
      const reloaded = await nav;
      check('confirmed update reloads without a second browser prompt', reloaded && unloadPrompts === 0, `reloaded=${reloaded} beforeunloadPrompts=${unloadPrompts}`);
      await page.goto(`${BASE}/diary`, { waitUntil: 'networkidle0' });
      await waitH1('Food diary');
      check('IndexedDB records survive the service-worker update', (await countEntries()) === 3 && (await bodyHas('E2E oats')));
      const newBanner = await bodyHas('A new version of NutriLedger is available');
      check('no stale update banner after updating', !newBanner);
    }
  } else {
    check('update flow (skipped: SW_FILE not set)', true);
  }

  check('no Gemini requests were made', geminiRequests.length === 0, geminiRequests.join(', '));
  const realErrors = pageErrors.filter((e) => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e));
  check('no uncaught page errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('script completed', false, String(err?.stack ?? err));
} finally {
  if (SW_FILE && originalSw !== null) writeFileSync(SW_FILE, originalSw);
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
