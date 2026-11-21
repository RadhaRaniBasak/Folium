// Plain-English reminders: @-menu chips, ⌘K quick add, the queue firing, Upcoming, settings.
import { email, register, setup, waitForEmptyEditor } from './lib.mjs';

const t = await setup('reminders');

await t.run(async () => {
  const A = await t.newUser('A');
  await register(A.page, 'Hydra Basak', email('remind'));
  const { page } = A;

  await page.getByRole('button', { name: 'New page' }).first().click();
  await waitForEmptyEditor(page);
  await page.fill('textarea[aria-label="Page title"]', 'Bills');
  await page.keyboard.press('Enter');

  // "@every 1st at 9am" — the menu stays open while the phrase is typed
  await page.keyboard.type('Pay rent ');
  await page.keyboard.type('@ev');
  await page.waitForSelector('.bn-suggestion-menu >> text=Remind me tomorrow');
  await page.keyboard.type('ery 1st at 9am', { delay: 15 });
  await page.waitForSelector('.bn-suggestion-menu >> text=Every month on the 1st at 9:00 AM');
  await page.keyboard.press('Enter');
  await page.waitForSelector(
    '.bn-editor .reminder-chip:has-text("Every month on the 1st at 9:00 AM")',
  );
  t.log('@every 1st at 9am becomes a repeating reminder chip');

  // ⌘K quick add, firing a few seconds later through the queue
  await page.keyboard.press('Control+k');
  await page.fill('input[aria-label="Search pages and actions"]', 'call the bank in 6 seconds');
  await page.waitForSelector('[role=option]:has-text("Remind me to call the bank")');
  await t.shot(page, '30-quick-add');
  await page.keyboard.press('Enter');
  await page.waitForSelector('text=Reminder set');
  await page.waitForSelector(
    '.bn-editor [data-content-type=checkListItem]:has-text("call the bank") .reminder-chip',
  );
  t.log('quick add puts a to-do with a reminder on the open page');

  await page.waitForSelector('text=⏰ call the bank', { timeout: 20000 });
  await page.waitForSelector('aside [aria-label="1 unread"]');
  t.log('the queue fires it: toast and inbox badge');

  await page.locator('aside button', { hasText: 'Inbox' }).click();
  await page.waitForSelector('[role=dialog] >> text=call the bank');
  await page.getByRole('tab', { name: 'Upcoming' }).click();
  await page.waitForSelector('[role=dialog] >> text=Every month on the 1st at 9:00 AM');
  await page.waitForSelector('[role=dialog] >> text=Pay rent');
  await t.shot(page, '31-upcoming');
  await page.keyboard.press('Escape');
  t.log('Upcoming lists the repeating reminder');

  // settings: WhatsApp number + toggle
  await page.locator('aside').getByRole('button').first().click();
  await page.getByRole('menuitem', { name: 'Notifications…' }).click();
  await page.waitForSelector('[role=dialog] >> text=Push notifications');
  await page.fill('input[aria-label="Phone number"]', '+91 98765 43210');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForSelector('text=Phone number saved');
  await page.getByRole('switch', { name: 'WhatsApp' }).click();
  await page.waitForSelector('[role=switch][aria-label=WhatsApp][aria-checked=true]');
  await t.shot(page, '32-settings');
  t.log('WhatsApp number saved and reminders switched on');
});
