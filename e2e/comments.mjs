// Comments (live, with notifications) and version history (name, preview, restore).
import { editorHas, email, register, setup, waitForEmptyEditor } from './lib.mjs';

const t = await setup('comments & history');

await t.run(async () => {
  const A = await t.newUser('A');
  await register(A.page, 'Hydra Basak', email('hydra'));
  const B = await t.newUser('B');
  const emailB = email('bo');
  await register(B.page, 'Bo Chen', emailB);

  await A.page.getByRole('button', { name: 'Share' }).click();
  await A.page.fill('input[placeholder="Email of a Folium user"]', emailB);
  await A.page.getByRole('button', { name: 'Invite', exact: true }).click();
  await A.page.waitForSelector(`text=${emailB}`, { timeout: 8000 });
  await A.page.keyboard.press('Escape');

  await A.page.getByRole('button', { name: 'New page' }).first().click();
  await waitForEmptyEditor(A.page);
  await A.page.fill('textarea[aria-label="Page title"]', 'Spec');
  await A.page.keyboard.press('Enter');
  await A.page.keyboard.type('The launch date is Friday');
  const url = A.page.url();

  // B comments on A's page; A hears about it
  await B.page.goto(url);
  await editorHas(B.page, 'The launch date is Friday');
  await B.page.dblclick('.bn-editor >> text=launch');
  await B.page.keyboard.press('Shift+End');
  await B.page.getByRole('button', { name: 'Add comment' }).click();
  await B.page.keyboard.type('Can we move this to Monday?');
  await B.page.keyboard.press('Enter');
  await B.page.waitForSelector('.bn-editor .bn-thread-mark');
  t.log('B selects text and comments');

  await A.page.waitForSelector('text=Bo Chen commented on Spec');
  await A.page.waitForSelector('.bn-editor .bn-thread-mark');
  await A.page.locator('aside button', { hasText: 'Inbox' }).click();
  await A.page.waitForSelector('[role=dialog] >> text=Can we move this to Monday?');
  await A.page.locator('[role=dialog] button', { hasText: 'commented on' }).click();
  await A.page.waitForSelector('.bn-thread >> text=Can we move this to Monday?');
  await t.shot(A.page, '40-thread');
  t.log('A is notified live and the inbox opens the thread');

  await A.page.keyboard.press('Escape');
  await A.page.getByRole('button', { name: 'Comments' }).click();
  await A.page.waitForSelector('.folium-panel >> text=Can we move this to Monday?');
  await A.page.getByRole('button', { name: 'Close comments' }).click();
  t.log('the comments panel lists open threads');

  // version history: name a version, change the page, preview and restore the old one
  await A.page.getByRole('button', { name: 'Page options' }).click();
  await A.page.getByRole('menuitem', { name: 'Version history' }).click();
  await A.page.waitForSelector('.bn-versioning-sidebar');
  await A.page.getByRole('button', { name: 'More actions' }).first().click();
  await A.page.getByRole('menuitem', { name: 'Name this version' }).click();
  await A.page.keyboard.type('Before the date change');
  await A.page.keyboard.press('Enter');
  await A.page.waitForSelector('.bn-versioning-sidebar >> text=Before the date change');
  await A.page.getByRole('button', { name: 'Close', exact: true }).click();
  t.log('named a version');

  await A.page.click('.bn-editor >> text=Friday');
  await A.page.keyboard.press('End');
  await A.page.keyboard.type(', or maybe never');
  await editorHas(B.page, 'or maybe never');

  await A.page.getByRole('button', { name: 'Page options' }).click();
  await A.page.getByRole('menuitem', { name: 'Version history' }).click();
  await A.page.locator('.bn-versioning-sidebar', { hasText: 'Before the date change' }).waitFor();
  await A.page.locator('.bn-versioning-sidebar >> text=Before the date change').click();
  await A.page.waitForFunction(
    () => !document.querySelector('.bn-editor')?.textContent?.includes('maybe never'),
  );
  await t.shot(A.page, '41-history-preview');
  t.log('selecting the version previews it');

  await A.page
    .locator('.bn-snapshot[aria-label^="Before the date change"]')
    .getByRole('button', { name: 'More actions' })
    .click();
  await A.page.getByRole('menuitem', { name: /Restore/ }).click();
  const confirm = A.page.getByRole('button', { name: /^Restore/ });
  if (await confirm.count()) await confirm.last().click();
  await A.page.waitForFunction(
    () => !document.querySelector('.bn-editor')?.textContent?.includes('maybe never'),
  );
  await B.page.waitForFunction(
    () => !document.querySelector('.bn-editor')?.textContent?.includes('maybe never'),
  );
  await A.page.waitForSelector('.bn-editor .bn-thread-mark'); // comment highlight survives
  t.log('restoring brings the old text back for everyone');

  if (await A.page.locator('.bn-versioning-sidebar').count()) {
    await A.page.getByRole('button', { name: 'Close', exact: true }).click();
  }
  await A.page.getByRole('button', { name: 'Page options' }).click();
  await A.page.getByRole('menuitem', { name: 'Version history' }).click();
  await A.page.waitForSelector('.bn-versioning-sidebar >> text=Before restore');
  t.log('…and keeps a “Before restore” version');
});
