// Sidebar tree: drag to nest/reorder, cycle protection, persistence, page menu, rename.
import { email, register, setup, treeRow, waitForEmptyEditor } from './lib.mjs';

const t = await setup('sidebar');

await t.run(async () => {
  const { page } = await t.newUser('D');
  await register(page, 'Dee', email('dee'));

  const parentOf = (title) =>
    page.evaluate((name) => {
      const li = [...document.querySelectorAll('[role=treeitem]')].find((el) =>
        el.firstElementChild?.textContent?.includes(name),
      );
      return (
        li?.parentElement?.closest('[role=treeitem]')?.firstElementChild?.textContent?.trim() ??
        null
      );
    }, title);

  const newPage = async (title) => {
    const before = page.url();
    await page.getByRole('button', { name: 'New page' }).first().click();
    await page.waitForURL((u) => u.href !== before);
    await waitForEmptyEditor(page);
    await page.fill('textarea[aria-label="Page title"]', title);
    await page.waitForSelector(`[role=treeitem] > div:has-text("${title}")`);
  };

  await newPage('Inbox');
  await newPage('Archive');
  await page.waitForTimeout(500);

  await treeRow(page, 'Archive').dragTo(treeRow(page, 'Inbox'), {
    targetPosition: { x: 120, y: 15 },
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[role=treeitem]')].some(
      (li) =>
        li.firstElementChild?.textContent?.includes('Inbox') &&
        li.querySelector('[role=group]')?.textContent?.includes('Archive'),
    ),
  );
  t.log('drop in the middle nests a page');

  await treeRow(page, 'Inbox').dragTo(treeRow(page, 'Getting started'), {
    targetPosition: { x: 120, y: 3 },
  });
  await page.waitForFunction(() =>
    document
      .querySelector('nav[aria-label=Pages] > section:last-child > ul > [role=treeitem]')
      ?.firstElementChild?.textContent?.includes('Inbox'),
  );
  t.log('drop on the top edge reorders');

  await treeRow(page, 'Inbox').dragTo(treeRow(page, 'Archive'), {
    targetPosition: { x: 120, y: 15 },
  });
  await page.waitForTimeout(400);
  if ((await parentOf('Archive')) !== 'Inbox')
    throw new Error('dropping a page into its own subpage should be ignored');
  await page.reload();
  await page.waitForSelector('[role=treeitem]');
  await page.waitForTimeout(400);
  if ((await parentOf('Archive')) !== 'Inbox') throw new Error('nesting was not saved');
  t.log('cycle drop ignored, tree saved');

  await page.getByRole('button', { name: 'Page options' }).click();
  await page.getByRole('button', { name: /Serif/ }).click();
  await page.getByRole('menuitem', { name: 'Full width' }).click();
  await page.waitForFunction(
    () => document.querySelector('.folium-editor')?.getAttribute('data-font') === 'serif',
  );
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export as Markdown' }).click();
  if (!(await download).suggestedFilename().endsWith('.md'))
    throw new Error('expected a .md export');
  t.log('font, full width, markdown export');

  await page.keyboard.press('Control+Backslash');
  await page.waitForSelector('button[aria-label="Open sidebar"]');
  await page.keyboard.press('Control+Backslash');
  await treeRow(page, 'Archive').hover();
  await treeRow(page, 'Archive').getByRole('button', { name: 'Page actions' }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Old ideas');
  await page.keyboard.press('Enter');
  await page.waitForSelector('[role=treeitem] > div:has-text("Old ideas")');
  t.log('sidebar shortcut, inline rename');
});
