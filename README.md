# NutriLedger

**Nutrition, measured clearly.**

NutriLedger is a private nutrition diary and energy calculator that runs in your browser. Everything is stored on your device. It has no accounts, no backend, no analytics and no trackers. An optional AI assistant uses **your own** Google Gemini API key, and the app sends nothing anywhere unless you explicitly ask it to.

> NutriLedger gives general estimates for information only. It is not medical advice and does not diagnose or treat any condition. People who are pregnant, under 18, managing a medical condition or recovering from disordered eating should get guidance from a qualified professional.

---

## Contents

1. [Features](#1-features)
2. [Tech stack](#2-tech-stack)
3. [Run locally](#3-run-locally)
4. [Scripts](#4-scripts)
5. [Testing](#5-testing)
6. [Production build](#6-production-build)
7. [Deploy to Vercel (free tier)](#7-deploy-to-vercel-free-tier)
8. [Install and offline use (PWA)](#8-install-and-offline-use-pwa)
9. [Optional AI: bring your own Gemini key](#9-optional-ai-bring-your-own-gemini-key)
10. [Your data: storage, export, import, deletion](#10-your-data-storage-export-import-deletion)
11. [Formulas and sources](#11-formulas-and-sources)
12. [Project structure](#12-project-structure)
13. [Security and privacy notes](#13-security-and-privacy-notes)
14. [Limitations, key risks and untested areas](#14-limitations-key-risks-and-untested-areas)

---

## 1. Features

| Section | What it does |
| --- | --- |
| **Dashboard** | Today's calories and macros. Shows a target and what remains **only if you set or accepted one**, plus a per-meal breakdown and recent entries. Also shows BMR, TDEE and energy balance (intake − TDEE, labelled as an estimate) and a 7-day intake chart where unlogged days stay empty instead of counting as zero. Covers every state: new user, incomplete profile, nothing logged today, offline, no AI key, and storage unavailable. |
| **Food Diary** | Add, edit, duplicate, delete and move entries between dates and meals. **Duplicate** opens a pre-filled new entry for the day you're viewing; you can change anything (including date and meal) before saving, and the original is untouched. Meals are Breakfast, Lunch, Dinner, Snacks, Other, plus your own custom meals. Each entry has name, quantity, unit, calories, protein, carbs, fat, optional fiber and notes. Its source is shown as manual, nutrition label, or AI estimate. Includes "Save and add another", undo for single deletes and a confirmation for bulk deletes. A nutrition-label calculator scales label values to the portion you ate. There is date navigation with a Today button, meal filters and search across all entries. **A missing macro is shown as "Not recorded", never as 0.** |
| **Calculator** | Local only. Takes age, sex, height, weight, activity level, optional neck/waist/hip, metric or imperial units, an assessment date and notes. Uses Mifflin–St Jeor BMR × activity multiplier → TDEE. Optionally estimates body fat with the US Navy method and adds a Katch–McArdle BMR. Validates fields inline with practical bounds; assessment dates must be real and not in the future. Switching units never changes what you typed: untouched fields switch back exactly (e.g. 178 cm stays 178 cm, not 178.1 cm after a round trip through 5 ft 10.1 in). Assessments are saved to a history; new ones never overwrite old ones. Under 18: no estimates or targets are shown. |
| **Progress** | Weight records and assessments, plus daily calorie and macro charts over 7d / 30d / 90d / 1y / all. Raw values only, with no smoothing or extrapolation. Days with nothing logged are left out of averages and charts, not counted as zero. Records can be deleted with undo, and all weights can be cleared after confirmation. Every chart has a table view. |
| **AI Nutrition** (optional) | Estimate a meal from text or from a photo. The result is structured JSON, validated with Zod and labelled as an unverified estimate. **Nothing is saved until you review it.** Also offers meal ideas, a plain-language explanation of your calculations (the numbers are computed locally, and any unexpected numbers in the reply are flagged), a summary of a date range (you see exactly what will be sent first, and notes are never sent), and cautious general Q&A. Every tool supports cancel, has a timeout and gives specific error messages. All AI tools are disabled while offline. |
| **Settings** | Theme (light/dark/system), units, daily targets (an empty field means no target), custom meals, the Gemini key and model, CSV/JSON export, backup import, clearing data, a storage usage readout and a button to request persistent storage. Also includes privacy information, install guidance and the app version. |

## 2. Tech stack

- React 19, Vite 8, TypeScript 6 (`strict`, `noUncheckedIndexedAccess`, no `any` and no `@ts-ignore`)
- React Router 8 (`BrowserRouter`; `vercel.json` rewrites every route to `index.html`)
- CSS Modules with design tokens (`src/styles/tokens.css`, `themes.css`, `global.css`)
- IndexedDB via `idb` for records; localStorage only for small preferences (and, if you opt in, your API key)
- Zod 4 for all validation: forms, imports and AI output
- Recharts (lazy-loaded) for charts
- `@google/genai` (official SDK, loaded only when you first use AI)
- vite-plugin-pwa / Workbox for the service worker and manifest
- Vitest, Testing Library, jsdom and fake-indexeddb for tests
- Self-hosted fonts: Public Sans and Newsreader (`@fontsource-variable`)

## 3. Run locally

Requirements: Node.js 20.19+ or 22.12+ (developed on Node 22) and npm.

```bash
npm install
npm run dev          # http://localhost:5173
```

To try the production build, including the service worker and offline mode:

```bash
npm run build
npm run preview      # http://localhost:4173
```

You do **not** need an API key. Every feature except the AI tools works without one.

## 4. Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (the service worker is not registered in dev) |
| `npm run build` | `tsc -b && vite build` → `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | ESLint (typescript-eslint, react-hooks, react-refresh) |
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |

The PWA icons in `public/icons/` are committed. To regenerate them from the logo artwork (sharp is deliberately **not** a project dependency):

```bash
npm i --no-save sharp@0.34 && node scripts/generate-icons.mjs
```

## 5. Testing

```bash
npm test
```

Current result: **30 test files, 230 tests, all passing**.

| Category | Tests | Files |
| --- | ---: | --- |
| Calculations: Mifflin–St Jeor, activity, TDEE, Katch–McArdle, US Navy body fat, units, nutrition totals and scaling | 44 | `src/lib/calculations/*.test.ts` |
| Validation and form logic: food, calculator (incl. lossless unit switching, assessment dates), weight, targets, progress series | 31 | `src/features/**/*.test.ts` |
| Persistence on fake IndexedDB: schema, upgrade safety, CRUD, corrupted records, atomic import, bulk delete, memory fallback, data store, failed/quota-exceeded writes leaving state unchanged | 21 | `src/lib/database`, `src/app/dataStore.test.ts` |
| Export and import: CSV escaping and formula injection, backup round trip, no API key, size/type/version checks, duplicate policy, partial imports with a rejected-items report | 24 | `src/lib/export`, `src/lib/import` |
| AI with a mocked SDK: schema validation, error classification, retries, timeouts, cancel, stale responses, prompts, key storage, image checks | 30 | `src/lib/ai/ai.test.ts` |
| Formatting | 12 | `src/lib/formatting/*.test.ts` |
| App state: preferences (incl. retired model migration), unsaved-changes guard, toast limits | 10 | `src/app/*.test.ts`, `src/components/feedback` |
| PWA and deploy config: manifest fields, icons exist with correct pixel sizes, no runtime caching, prompt-based update, CSP, SPA rewrite | 5 | `src/test/pwa.test.ts` |
| **Component/integration (whole app rendered)** | 53 | `src/test/integration/*.test.tsx` |

The integration tests render the real `<App/>` with its router and providers against an in-memory repository and click through it with `user-event`. They cover:

- navigation and the 404 page
- new-user empty states
- diary CRUD with undo, plus validation
- dashboard and diary totals staying consistent
- calculator results, imperial input, the under-18 rule and assessment history
- targets and remaining calories
- theme and units
- entering and removing the API key, and remembering it only after opt-in
- AI estimate → review → save, the invalid-key error keeping your input, malformed output, cancel, offline, and plain-text rendering (markup is never interpreted)
- JSON/CSV export without the key, import preview → confirm, invalid files, and the clear-all typed confirmation
- the storage-unavailable fallback
- reliability: duplicate, a rapid repeated save creating one entry, edits never duplicating, a full device (quota error) keeping the form and data unchanged, a failed bulk delete keeping the confirmation open with an error, partial imports, and the update prompt asking before discarding unsaved input

### Real-browser checks (headless Chromium)

Two scripts in `scripts/` drive a real headless Chromium (via `puppeteer-core`, which is **not** a project dependency) against the production build served by `npm run preview`:

- `scripts/browser-audit.mjs` loads every route at 320, 360, 375, 390, 430, 768, 1024, 1280 and 1440 px, in light and dark themes, empty and with seeded records (324 page loads). It checks for horizontal overflow, clipped text, content hidden behind the bottom navigation and touch targets under 44 px, runs axe-core at 375 and 1280 px, records console errors and saves screenshots to `audit-out/` (git-ignored).
- `scripts/browser-e2e.mjs` checks that the service worker takes control, an entry survives reload, a rapid triple click on Save creates one entry, duplicate works, the app reloads and accepts new entries **offline**, AI is clearly disabled offline, a new release is announced rather than auto-applied, the update never reloads over unsaved input without asking, and IndexedDB records survive the update. It makes no Gemini requests.

```bash
# in any scratch directory
npm i puppeteer-core axe-core
CHROME_PATH=/path/to/chrome BASE_URL=http://localhost:4173 node /path/to/NutriLedger/scripts/browser-audit.mjs
CHROME_PATH=/path/to/chrome SW_FILE=/path/to/NutriLedger/dist/sw.js node /path/to/NutriLedger/scripts/browser-e2e.mjs
```

Last results: audit — 0 layout findings, 0 axe violations, 0 console errors; e2e — 17/17 checks passed. These ran in headless Chromium in a Linux sandbox, **not** on physical phones, Safari or Firefox.

### Acceptance scenario

`src/test/integration/acceptance.test.tsx` runs this 23-step journey as one automated test:

1. Open the app for the first time: empty dashboard, no target, no invented data.
2. Open the Calculator.
3. Enter a profile (30 y, female, 165 cm, 60 kg, lightly active).
4. Calculate: BMR 1,320, TDEE 1,815 kcal/day.
5. Save the assessment to history.
6. Explicitly accept TDEE as the daily calorie target.
7. Add a protein target in Settings.
8. Log breakfast in the diary.
9. Log lunch.
10. Edit lunch: the totals update.
11. Delete breakfast, then undo.
12. Dashboard totals match the diary, and remaining = target − intake.
13. Record a weight in Progress.
14. Add a Gemini key for this session only.
15. Get an AI estimate from text (mocked) and review and edit it.
16. Save it. It shows in the diary with an "AI estimate" badge.
17. Go offline: AI is disabled, and the diary still works.
18. Export a JSON backup: it contains the records and not the key.
19. Reload: the records persist, and the session-only key was never stored.
20. Open "Clear all local data".
21. Type DELETE to confirm: everything is removed.
22. Import the backup: preview, then confirm, and the data is restored.
23. The dashboard reflects the restored data.

## 6. Production build

```bash
npm run build
```

Output goes to `dist/`. The main bundle is about 272 kB (about 86 kB gzip). Recharts (about 338 kB) and the Gemini SDK (about 368 kB) are split into chunks that load on demand. The service worker precaches the app shell, every route chunk and the fonts (54 entries, about 1.5 MB), so every local feature works offline after the first visit.

`build.modulePreload` is turned off in `vite.config.ts`. With it on, Chromium logs a "preload … service worker resource mismatch" warning on every visit once the service worker is in control (a known vite-plugin-pwa interaction with no functional effect). The cost is a slightly slower very first load, before the service worker is installed.

## 7. Deploy to Vercel (free tier)

1. Push the repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`. No environment variables are needed, and you should **not** add a Gemini key.
4. Deploy.

`vercel.json` already sets up:

- an SPA rewrite to `/index.html`
- `Cache-Control: no-cache` for `sw.js` and the manifest, and immutable caching for `/assets/*`
- security headers: CSP, `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `frame-ancestors 'none'`

The CSP allows network connections only to the app itself and `https://generativelanguage.googleapis.com`.

> This repository has **not** been deployed to Vercel as part of development. The steps above are the expected setup and have not been run.

## 8. Install and offline use (PWA)

- **Install:** Chrome, Edge and Android show an *Install* button in Settings when the browser offers one. On iPhone and iPad, use Safari → Share → *Add to Home Screen*.
- **Offline:** after the first load, the diary, calculator, progress, settings, export and import all work with no connection. A banner shows when you are offline. AI tools are disabled while offline, with a clear message, and never return placeholder results.
- **Updates:** a new version is never applied silently. A "Reload to update" prompt appears; if any form (food entry, calculator, targets, weight, or an AI estimate waiting for review) has unsaved input, the app asks first and you can choose *Not now*. While a form has unsaved input, the browser also warns before the tab is closed. Updates never change your stored records.
- The service worker never caches Gemini requests (`runtimeCaching` is empty).

## 9. Optional AI: bring your own Gemini key

1. Create a key at [Google AI Studio](https://aistudio.google.com/apikey). Google's free tier is enough for personal use, but check Google's current terms and quotas.
2. In **Settings → AI assistant**, paste the key. You can use **Show key** to check it.
3. Optionally click **Test connection**. Nothing is sent until you click it.
4. Choose a model from the list. Gemini 3.8 Flash is the default; Gemini 3.6 Flash, the 3.5 and 3.1 Flash-Lite models and the `gemini-flash-latest` alias are also offered (checked against Google's model list in October 2026). A previously saved model that is no longer offered, such as the deprecated `gemini-3.5-flash`, switches to the default automatically.

**How the key is handled**

- By default the key is held **in memory only** and is gone when you close the tab.
- If you tick **Remember this key on this device**, it is stored **unencrypted** in this browser's localStorage. Anyone with access to this browser profile, or any script that runs on this origin, could read it. Only opt in on a personal device.
- The key is sent **directly from your browser to Google** in the `x-goog-api-key` request header. It is never put in URLs, logs, exports, backups or error messages, and the app never sends it to any other server.
- **Remove key** deletes it from memory and from localStorage. "Clear all local data" does the same.

**What is sent to Google, and only when you press the action button**

| Tool | Sent |
| --- | --- |
| Estimate from text | The description you typed |
| Estimate from photo | The image you picked (downscaled to at most 1600 px, re-encoded as JPEG, which drops most metadata) and your optional note |
| Meal ideas | The meal type, preferences, restrictions and ingredients you typed |
| Explain my calculations | The numbers and formulas computed locally, which are shown to you before sending |
| Summarize a date range | Daily totals for the range. Food names are sent only if you tick that option. **Notes are never sent.** You see a preview first. |
| Ask a question | Only your question, with no records |

Google processes this data under its own terms. On the free tier, Google may use the content you send to improve its products. Don't send anything you would not want shared.

AI results are **estimates and unverified**. Food estimates are shown in an editable review form and are only saved when you confirm. Saved estimates carry an "AI estimate" label everywhere.

## 10. Your data: storage, export, import, deletion

- **Where:** IndexedDB database `nutriledger` (records) and localStorage key `nutriledger.preferences.v1` (theme, units and similar settings). Values are stored in metric internally and converted for display.
- **Local data can be lost.** Clearing browser data, uninstalling the app, private browsing, or the browser evicting storage when space is low can remove everything. Use **Settings → Request persistent storage** to ask the browser not to evict it, and **export backups regularly**.
- If the browser blocks IndexedDB (for example in some private modes), the app warns you and keeps working in memory for that tab only.
- **Export:**
  - A JSON backup with `schemaVersion` holds everything except the API key.
  - CSV files are available for food entries, weights, assessments and daily totals. Fields are RFC 4180 quoted, and cells that begin with `=`, `+`, `-`, `@`, `|`, `%`, a tab or a carriage return are prefixed with `'` so spreadsheet apps can't run them as formulas.
- **Import (JSON backup):**
  - The file is checked for type and size (20 MB limit), parsed, validated with Zod, and checked for a supported schema version.
  - You get a preview of what will be added, skipped or replaced before anything changes.
  - **Damaged files vs damaged records:** if the file itself is broken (not JSON, not a NutriLedger backup, a newer schema version, or missing record lists), nothing is imported. If only some records are invalid, those records are skipped and listed (type, position, ID and reason) before you confirm; the button reads *Import valid records*. A damaged profile, targets or custom-meals section never overwrites your current one, even in *replace* mode.
  - You can **merge** or **replace everything**.
  - **Duplicate policy (merge):**
    - A record with the same ID and identical content is skipped.
    - When the same ID has different content, you choose to *keep existing* (the default) or *use the backup*.
    - If a file repeats an ID within itself, every copy of that ID is skipped and reported (the app can't tell which one is right).
  - The import runs in a **single IndexedDB transaction**, so if anything fails, your existing data stays as it was.
- **Failed saves:** every write goes to IndexedDB before the screen updates, so a failed save never shows data that wasn't stored. If the device is out of storage space, the app says so specifically, keeps what you typed, and nothing is changed; free space (or export and delete old records) and retry.
- **Delete:** single entries (with undo), all entries for a day, or all weights, each with confirmation. Assessments can be deleted from history. **Clear all local data** asks you to type `DELETE`. It removes all records, the stored key and your preferences.

## 11. Formulas and sources

All calculations run locally in `src/lib/calculations/`. They check for NaN/Infinity and practical bounds, and return errors instead of throwing or showing nonsense.

**Mifflin–St Jeor BMR** (Mifflin et al., *Am J Clin Nutr* 1990;51:241–7). Weight in kg, height in cm, age in years:

```
male   BMR = 10·w + 6.25·h − 5·a + 5
female BMR = 10·w + 6.25·h − 5·a − 161
```

**TDEE** = BMR × activity multiplier:

| Activity level | Multiplier |
| --- | ---: |
| Sedentary | 1.2 |
| Lightly active | 1.375 |
| Moderately active | 1.55 |
| Very active | 1.725 |
| Extra active | 1.9 |

**Katch–McArdle BMR** (optional; needs a body-fat estimate): `BMR = 370 + 21.6 · LBM(kg)`, where `LBM = weight × (1 − BF%/100)`.

**US Navy circumference body fat** (Hodgdon & Beckett 1984, Naval Health Research Center reports 84-11 and 84-29; metric form, log base 10, cm):

```
male   %BF = 495 / (1.0324  − 0.19077·log10(waist − neck)       + 0.15456·log10(height)) − 450
female %BF = 495 / (1.29579 − 0.35004·log10(waist + hip − neck) + 0.22100·log10(height)) − 450
```

The inputs are checked before any calculation:

- Every log argument must be greater than 0. For men, waist must be greater than neck.
- The denominator must be positive.
- The result must be finite and between 2% and 65%. Anything outside that range almost always means a measurement error, so the app shows a message instead.

**Energy balance** = calories logged today − TDEE. This is labelled as an estimate, because logging is often incomplete.

**Portion scaling**: `portion value = label value × amount eaten ÷ reference amount`. This only works when both amounts use the same unit; NutriLedger never converts between units such as grams and cups.

**Input bounds**:

| Field | Allowed range |
| --- | --- |
| Age | 1–120 years (estimates only for 18+) |
| Height | 50–272 cm |
| Weight | 20–500 kg |
| Neck | 20–80 cm |
| Waist | 40–250 cm |
| Hip | 50–250 cm |
| Calories per entry | 0–10,000 |
| Calorie target | 500–10,000 |

A caution appears below 1,200 kcal.

**Under 18**: the calculator saves the profile but shows no BMR/TDEE-based targets and no deficit guidance, and suggests professional advice instead.

## 12. Project structure

```
src/
  app/            App shell wiring: router, providers, data store, preferences, theme, PWA
  components/     Shared UI: common, layout, navigation, forms, feedback, dialogs, charts
  features/       dashboard, food-diary, calculator, progress, ai-nutrition, settings
  hooks/          useOnlineStatus, useTodayKey, useInstallPrompt, useAiRequest, useDerived
  lib/
    calculations/ BMR, TDEE, body fat, units, nutrition totals
    database/     IndexedDB repository, memory fallback, snapshot sanitising
    validation/   Zod schemas and bounds
    export/       CSV, JSON backup, download
    import/       Backup parsing and import planning
    ai/           Gemini client wrapper, models, key store, prompts, schemas, errors
    formatting/   Dates, numbers, AI text
  styles/         tokens.css, themes.css, global.css
  types/          Entity types
  test/           Setup, factories, app render helper, integration tests
public/           favicon, theme-init.js, PWA icons
scripts/          Icon generator
```

## 13. Security and privacy notes

These checks were done during development:

- No backend, analytics, trackers, third-party fonts or CDNs. Fonts are self-hosted.
- No hard-coded key. A search of `src/`, `public/` and `dist/` for key-like strings (`AIza…`) finds none outside test fixtures.
- AI output is rendered as plain text by a small parser that recognises paragraphs and lists. The code has no `dangerouslySetInnerHTML`, `innerHTML` or `eval`.
- The CSP allows scripts only from the app itself (`script-src 'self'`); the theme bootstrap script is a separate file instead of inline code. `object-src 'none'`, `frame-ancestors 'none'` and `Referrer-Policy: no-referrer` are set.
- Errors are mapped to fixed messages. Raw provider messages, request bodies and keys are never shown or logged. Console output is limited to three generic diagnostics (storage unavailable, database upgrade blocked, component render failure). None of them contains user data.
- Imports are validated with Zod; unknown fields are dropped and IDs and values are checked. Image uploads are checked for type and size (JPEG/PNG/WebP/HEIC, 10 MB or less).
- `npm audit`: 0 vulnerabilities at the time of writing.

## 14. Limitations, key risks and untested areas

**Limitations**

- Nutrition values are whatever you enter, or AI estimates. There is no verified food database.
- BMR/TDEE and body-fat formulas are population estimates. Individual error of ±10% or more is common, and they are not valid for children or during pregnancy.
- No sync between devices. Moving data means export, then import.
- No unit conversion between different serving units, by design.
- Photo estimation depends on the model and the photo. It is often wrong about portion size and hidden ingredients.
- The list of Gemini models is fixed and will need updating as Google retires models.

**Key risks**

- **Data loss:** all data lives in one browser profile. Without regular backups, clearing site data or storage eviction deletes it permanently.
- **API key exposure:** a remembered key is stored unencrypted in localStorage. Use session-only on shared devices, and set usage limits on the key in Google AI Studio.
- **Data sharing:** anything you send to an AI tool goes to Google and is handled under Google's terms (see section 9).
- **Over-trusting estimates:** AI and formula outputs are labelled as estimates, but users may still treat them as precise.

**Untested or only partly tested**

- **Real-browser coverage is headless Chromium only** (see *Real-browser checks* in section 5). Layout at 320–1440 px, axe (including colour contrast in both themes), offline reload and the update flow were checked there. **Not** checked:
  - physical Android/iOS devices, on-screen keyboards, and safe-area insets on notched phones
  - Safari and Firefox (including IndexedDB in their private modes)
  - the install prompt / Add to Home Screen flow
  - screen readers (axe checks markup, not the spoken experience)
- **No live Gemini calls.** All AI behaviour is tested against a mocked SDK, so the exact error formats from the live API have not been confirmed. Model IDs were checked against Google's published model list (October 2026), not by calling the API.
- **Not deployed to Vercel.**

## License

No license has been specified yet.
