// Shared helpers for the browser tests (Playwright driving a local Chrome).
import { chromium } from 'playwright-core';
import fs from 'node:fs';

export const BASE = process.env.E2E_URL ?? 'http://localhost:5173';
const SHOTS = process.env.E2E_SCREENSHOTS; // optional folder for screenshots
const stamp = Date.now();

/** A unique email per run, e.g. email('ada') → ada1795…@folium.dev */
export const email = (name) => `${name}${stamp}@folium.dev`;

export async function setup(name) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox'],
  });
  const errors = [];
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

  return {
    browser,
    log: (...parts) => console.log(`  • ${parts.join(' ')}`),
    async newUser(tag, colorScheme = 'light') {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        colorScheme,
        acceptDownloads: true,
      });
      await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`[${tag}] ${e.message}`));
      page.on('console', (m) => {
        // 401s are expected (no session yet, wrong password); network errors in offline tests;
        // a 404 is how an unpublished page answers.
        if (
          m.type() === 'error' &&
          !/status of 401|ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(m.text()) &&
          !m.location().url.includes('/api/public/')
        ) {
          errors.push(`[${tag}] ${m.text()}`);
        }
      });
      return { ctx, page };
    },
    shot: (page, file) => (SHOTS ? page.screenshot({ path: `${SHOTS}/${file}.png` }) : undefined),
    async run(steps) {
      console.log(name);
      try {
        await steps();
        if (errors.length) throw new Error(`console errors:\n${[...new Set(errors)].join('\n')}`);
        console.log(`✓ ${name} passed`);
      } catch (err) {
        console.error(`✗ ${name} failed: ${err.message}`);
        if (SHOTS) {
          for (const ctx of browser.contexts()) {
            for (const p of ctx.pages())
              await p.screenshot({ path: `${SHOTS}/fail-${Date.now()}.png` }).catch(() => {});
          }
        }
        process.exitCode = 1;
      } finally {
        await browser.close();
      }
    },
  };
}

export async function register(page, name, address) {
  await page.goto(`${BASE}/register`);
  await page.fill('input[autocomplete=name]', name);
  await page.fill('input[type=email]', address);
  await page.fill('input[autocomplete=new-password]', 'password123');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/p\//, { timeout: 15000 });
  await page.waitForSelector('.bn-editor', { timeout: 20000 });
}

export const editorHas = (page, text, timeout = 10000) =>
  page.waitForFunction(
    (t) => document.querySelector('.bn-editor')?.textContent?.includes(t),
    text,
    { timeout },
  );

/** Waits for a freshly created page: exactly one, empty, editor. */
export const waitForEmptyEditor = (page) =>
  page.waitForFunction(
    () => {
      const editors = document.querySelectorAll('.bn-editor');
      return editors.length === 1 && editors[0].textContent.trim() === '';
    },
    null,
    { timeout: 15000 },
  );

/** The row (not the nested children) of a sidebar page. */
export const treeRow = (page, title) =>
  page.locator('[role=treeitem] > div', { hasText: title }).first();
