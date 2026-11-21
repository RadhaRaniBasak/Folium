// Databases: table editing, properties, options, sorting, board drag and drop, row pages.
import { editorHas, email, register, setup } from './lib.mjs';

const t = await setup('databases');

await t.run(async () => {
  const A = await t.newUser('A');
  const { page } = A;
  await register(page, 'Hydra Basak', email('db'));

  await page.keyboard.press('Control+k');
  await page.fill('input[aria-label="Search pages and actions"]', 'Launch tasks');
  await page.locator('[role=option]', { hasText: 'New database “Launch tasks”' }).click();
  await page.waitForSelector('th >> text=Status');
  for (const name of ['Name', 'Status', 'Assignee', 'Due'])
    await page.waitForSelector(`th >> text=${name}`);
  t.log('a new database starts as a task table');

  const addRow = async (name) => {
    const before = await page.locator('tbody tr').count();
    await page.getByRole('button', { name: 'New', exact: true }).first().click();
    await page.waitForFunction(
      (n) => document.querySelectorAll('tbody tr').length === n + 1,
      before,
    );
    await page.keyboard.type(name);
    await page.keyboard.press('Enter');
  };
  await addRow('Write launch post');
  await addRow('Record demo');
  const row = (name) => page.locator('tbody tr', { has: page.locator(`input[value="${name}"]`) });
  await row('Write launch post').waitFor();

  await row('Write launch post').getByRole('button', { name: 'Status' }).click();
  await page.getByRole('menuitem', { name: 'In progress' }).click();
  await row('Write launch post').locator('text=In progress').waitFor();
  await row('Record demo').getByRole('button', { name: 'Status' }).click();
  await page.keyboard.type('Blocked');
  await page.keyboard.press('Enter');
  await row('Record demo').locator('text=Blocked').waitFor();
  t.log('select values, and new options typed in place');

  await page.getByRole('button', { name: 'Add a property' }).click();
  await page.fill('input[aria-label="Property name"]', 'Points');
  await page.getByRole('menuitem', { name: 'Number' }).click();
  await page.waitForSelector('th >> text=Points');
  await row('Write launch post').getByRole('textbox', { name: 'Points' }).fill('3');
  await page.keyboard.press('Enter');
  await row('Record demo').getByRole('textbox', { name: 'Points' }).fill('8');
  await page.keyboard.press('Enter');
  await page.locator('th', { hasText: 'Points' }).getByRole('button').click();
  await page.getByRole('menuitem', { name: 'Sort descending' }).click();
  await page.waitForFunction(
    () => document.querySelector('tbody tr input[aria-label=Name]')?.value === 'Record demo',
  );
  await t.shot(page, '50-table');
  t.log('number property, sorted descending');

  await page.getByRole('tab', { name: 'Board' }).click();
  const column = (name) => page.locator(`section[aria-label="${name}"]`);
  await column('In progress').locator('text=Write launch post').waitFor();
  await column('Blocked').locator('text=Record demo').waitFor();
  await page.dragAndDrop(
    'section[aria-label="In progress"] [role=link]',
    'section[aria-label="Done"]',
  );
  await column('Done').locator('text=Write launch post').waitFor();
  await t.shot(page, '51-board');
  t.log('board columns by Status; dragging a card changes it');

  await column('Done').locator('[role=link]', { hasText: 'Write launch post' }).click();
  await page.waitForSelector('textarea[aria-label="Page title"]');
  await page.locator('text=Add a property').waitFor();
  await page.getByRole('button', { name: 'Status' }).locator('text=Done').waitFor();
  await page.click('.bn-editor');
  await page.keyboard.type('Draft is in the shared folder');
  await editorHas(page, 'Draft is in the shared folder');
  t.log('a row opens as a page with its properties and its own content');

  const tree = await page.locator('[role=tree]').innerText();
  if (tree.includes('Write launch post'))
    throw new Error('rows should not be listed in the sidebar');
  if (!tree.includes('Launch tasks')) throw new Error('the database should be in the sidebar');
  t.log('rows stay out of the sidebar');
});
