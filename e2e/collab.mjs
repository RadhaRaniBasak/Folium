// Two people editing together: content, pages, search, sharing, live sync, presence, trash.
import { BASE, editorHas, email, register, setup, treeRow, waitForEmptyEditor } from './lib.mjs';

const t = await setup('collaboration');

await t.run(async () => {
  const A = await t.newUser('A');
  await register(A.page, 'Hydra Basak', email('hydra'));
  await editorHas(A.page, 'Try these', 15000);
  await t.shot(A.page, '01-welcome');
  t.log('welcome page seeded');

  // a page with content, icon, cover, subpage, favorite
  const welcomeUrl = A.page.url();
  await A.page.getByRole('button', { name: 'New page' }).first().click();
  await A.page.waitForURL((u) => u.href !== welcomeUrl);
  await waitForEmptyEditor(A.page);
  await A.page.fill('textarea[aria-label="Page title"]', 'Product roadmap');
  await A.page.keyboard.press('Enter');
  for (const line of [
    '# Q1 launch',
    'Ship the realtime editor and invite the first teams.',
    '[] Slash menu and block types',
    'Live cursors and presence',
  ]) {
    await A.page.keyboard.type(line);
    await A.page.keyboard.press('Enter');
  }
  const pageUrl = A.page.url();
  await A.page.hover('textarea[aria-label="Page title"]');
  await A.page.getByRole('button', { name: 'Add icon' }).click();
  await A.page.getByRole('button', { name: 'Add cover' }).click();
  await A.page.click('button[aria-label="Change icon"]');
  await A.page.fill('input[placeholder="Filter…"]', 'rocket');
  await A.page.locator('[frimousse-list] button', { hasText: '🚀' }).first().click();

  const row = treeRow(A.page, 'Product roadmap');
  await row.hover();
  await row.getByRole('button', { name: 'Add a page inside' }).click();
  await A.page.waitForURL((u) => u.href !== pageUrl);
  await waitForEmptyEditor(A.page);
  await A.page.fill('textarea[aria-label="Page title"]', 'Design system');
  await A.page.goto(pageUrl);
  await A.page.waitForSelector('.bn-editor');
  await A.page.getByRole('button', { name: 'Favorite' }).click();
  await A.page.waitForSelector('text=Favorites');
  await t.shot(A.page, '02-page');
  t.log('page with icon, cover, subpage, favorite');

  // content search (needs the autosaved block snapshot)
  await A.page.waitForTimeout(1800);
  await A.page.keyboard.press('Control+k');
  await A.page.keyboard.type('realtime');
  await A.page.waitForSelector('text=In page content', { timeout: 8000 });
  await A.page.keyboard.press('Escape');
  t.log('command palette searches page content');

  // a second person joins
  const B = await t.newUser('B', 'dark');
  const emailB = email('bo');
  await register(B.page, 'Bo Chen', emailB);
  await A.page.getByRole('button', { name: 'Share' }).click();
  await A.page.fill('input[placeholder="Email of a Folium user"]', emailB);
  await A.page.getByRole('button', { name: 'Invite', exact: true }).click();
  await A.page.waitForSelector(`text=${emailB}`, { timeout: 8000 });
  await A.page.keyboard.press('Escape');
  await B.page.goto(pageUrl);
  await editorHas(B.page, 'Q1 launch', 15000);
  t.log('invited B, B opens the page');

  await B.page.locator('.bn-editor').click();
  await B.page.keyboard.press('Control+End');
  await B.page.keyboard.press('Enter');
  await B.page.keyboard.type('Bo here — reviewing the launch plan now.');
  await editorHas(A.page, 'Bo here');
  await A.page.locator('.bn-editor').click();
  await A.page.keyboard.press('Control+End');
  await A.page.keyboard.press('Enter');
  await A.page.keyboard.type('Welcome aboard!');
  await editorHas(B.page, 'Welcome aboard');
  await A.page.waitForSelector('[title="Bo Chen"]', { timeout: 8000 });
  await t.shot(A.page, '03-collab');
  t.log('edits sync both ways, presence avatar shows');

  await A.page.fill('textarea[aria-label="Page title"]', 'Product roadmap 2027');
  await B.page.waitForSelector('[role=treeitem]:has-text("Product roadmap 2027")', {
    timeout: 8000,
  });
  t.log('rename appears live in the other sidebar');

  // offline edit syncs after reconnect
  await B.ctx.setOffline(true);
  await B.page.waitForSelector('text=Offline — edits will sync', { timeout: 10000 });
  await B.page.locator('.bn-editor').click();
  await B.page.keyboard.press('Control+End');
  await B.page.keyboard.press('Enter');
  await B.page.keyboard.type('Typed while offline.');
  await B.ctx.setOffline(false);
  await editorHas(A.page, 'Typed while offline', 20000);
  await A.page.reload();
  await editorHas(A.page, 'Typed while offline', 15000);
  t.log('offline edit synced and persisted');

  // trash with undo
  const sub = treeRow(A.page, 'Design system');
  await treeRow(A.page, 'Product roadmap 2027')
    .getByRole('button', { name: 'Expand' })
    .click()
    .catch(() => {});
  await sub.hover();
  await sub.getByRole('button', { name: 'Page actions' }).click();
  await A.page.getByRole('menuitem', { name: 'Move to trash' }).click();
  await A.page.waitForSelector('text=Moved to trash');
  await A.page.getByRole('button', { name: 'Trash' }).click();
  await A.page.waitForSelector('[aria-label="Trash"] >> text=Design system');
  await A.page.keyboard.press('Escape');
  t.log('trash');

  // login error state
  const C = await t.newUser('C');
  await C.page.goto(`${BASE}/login`);
  await C.page.fill('input[type=email]', email('hydra'));
  await C.page.fill('input[type=password]', 'wrong-password');
  await C.page.click('button[type=submit]');
  await C.page.waitForSelector('[role=alert]');
  t.log('login error state');
});
