// Offline-first: run against the production build (service worker), e.g. `vite preview`.
//   E2E_URL=http://localhost:4173 node e2e/offline.mjs
import { BASE, editorHas, email, register, setup } from './lib.mjs';

const t = await setup('offline-first');

await t.run(async () => {
  const address = email('olive');
  const { ctx, page } = await t.newUser('O');
  await register(page, 'Olive', address);
  await editorHas(page, 'Try these', 15000);

  // Let the service worker take control and cache the app.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await editorHas(page, 'Try these', 15000);
  const url = page.url();

  await ctx.setOffline(true);
  await page.reload();
  await editorHas(page, 'Try these', 15000);
  await page.waitForSelector('text=Offline — edits will sync', { timeout: 10000 });
  t.log('app and page open with no connection');

  await page.locator('.bn-editor').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Written offline, survives reloads.');
  await page.waitForTimeout(500);
  await page.reload();
  await editorHas(page, 'Written offline, survives reloads.', 15000);
  t.log('offline edit kept across a reload');

  await ctx.setOffline(false);
  await page.waitForSelector('text=Offline — edits will sync', {
    state: 'detached',
    timeout: 20000,
  });

  // A fresh browser (no device copy) sees the edit, so it reached the server.
  const other = await t.newUser('O2');
  await other.page.goto(`${BASE}/login`);
  await other.page.fill('input[type=email]', address);
  await other.page.fill('input[type=password]', 'password123');
  await other.page.click('button[type=submit]');
  await other.page.waitForURL(/\/p\//);
  await other.page.goto(url);
  await editorHas(other.page, 'Written offline, survives reloads.', 15000);
  t.log('edit synced to the server once back online');
});
