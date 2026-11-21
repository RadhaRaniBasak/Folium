// @-mentions, page links, backlinks, assignees and the live inbox.
import fs from 'node:fs';
import { email, register, setup, waitForEmptyEditor } from './lib.mjs';

const t = await setup('mentions & inbox');

const badge = (page, n) =>
  page.waitForSelector(`aside [aria-label="${n} unread"]`, { timeout: 10000 });
const inbox = (page) => page.locator('aside button', { hasText: 'Inbox' });

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
  await badge(B.page, 1);
  t.log('invite arrives in B’s inbox live');

  // two pages; the first mentions B and links the second
  await A.page.getByRole('button', { name: 'New page' }).first().click();
  await waitForEmptyEditor(A.page);
  await A.page.fill('textarea[aria-label="Page title"]', 'Specs');
  await A.page.getByRole('button', { name: 'New page' }).first().click();
  await A.page.waitForSelector('textarea[aria-label="Page title"]:text-is("")');
  await waitForEmptyEditor(A.page);
  await A.page.fill('textarea[aria-label="Page title"]', 'Launch plan');
  const planUrl = A.page.url();
  await A.page.keyboard.press('Enter');
  await A.page.keyboard.type('Ask ');
  await A.page.keyboard.type('@Bo');
  await A.page.waitForSelector('.bn-suggestion-menu >> text=Bo Chen');
  await A.page.keyboard.press('Enter');
  await A.page.keyboard.type('about ');
  await A.page.keyboard.type('@Spe');
  await A.page.waitForSelector('.bn-suggestion-menu >> text=Link to page');
  await A.page.keyboard.press('Enter');
  await A.page.waitForSelector('.bn-editor .mention-user:text("@Bo Chen")');
  await A.page.waitForSelector('.bn-editor .mention-page:has-text("Specs")');
  await t.shot(A.page, '20-mentions');
  t.log('@ menu inserts a person and a page link');

  await badge(B.page, 2);
  await B.page.waitForSelector('text=Hydra Basak mentioned you in Launch plan');
  await inbox(B.page).click();
  await B.page.waitForSelector('[role=dialog] >> text=mentioned you in');
  await t.shot(B.page, '21-inbox');
  await B.page.locator('[role=dialog] button', { hasText: 'mentioned you in' }).click();
  await B.page.waitForURL((u) => u.href.startsWith(planUrl));
  await B.page.waitForFunction(
    () =>
      [...document.querySelectorAll('.bn-block-content')].some(
        (el) => getComputedStyle(el).animationName === 'block-flash',
      ),
    null,
    { timeout: 10000 },
  );
  await B.page.waitForSelector('.bn-editor .mention-me:text("@Bo Chen")');
  await badge(B.page, 1);
  t.log('B opens the mention from the inbox, block highlighted');

  // page link → backlinks
  await A.page.click('.bn-editor .mention-page');
  await A.page.waitForURL((u) => u.href !== planUrl);
  await A.page.getByRole('button', { name: '1 backlink' }).click();
  await A.page.waitForSelector('a:has-text("Launch plan")');
  t.log('page link navigates, backlinks list the source');

  // assign B
  await A.page.hover('textarea[aria-label="Page title"]');
  await A.page.getByRole('button', { name: 'Assign' }).click();
  await A.page.locator('[role=menuitem]', { hasText: 'Bo Chen' }).click();
  await A.page.keyboard.press('Escape');
  await A.page.waitForSelector('text=Assignees');
  await t.shot(A.page, '22-assignees');
  await badge(B.page, 2);
  await inbox(B.page).click();
  await B.page.waitForSelector('[role=dialog] >> text=assigned you to');
  await B.page.getByRole('button', { name: 'Mark all as read' }).click();
  await B.page.waitForSelector('aside [aria-label$="unread"]', { state: 'detached' });
  t.log('assignment notifies B; mark all as read clears the badge');

  // mentions export to Markdown as text and links
  await A.page.goto(planUrl);
  await A.page.waitForSelector('.bn-editor .mention-user');
  await A.page.getByRole('button', { name: 'Page options' }).click();
  const download = A.page.waitForEvent('download');
  await A.page.getByRole('menuitem', { name: 'Export as Markdown' }).click();
  const md = fs.readFileSync(await (await download).path(), 'utf8');
  if (!md.includes('@Bo Chen') || !/\[Specs\]\(http[^)]+\/p\//.test(md))
    throw new Error(`unexpected Markdown:\n${md}`);
  t.log('Markdown export keeps @names and page links');
});
