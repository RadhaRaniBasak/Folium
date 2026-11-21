// Templates, Markdown import, embeds, uploads (cover + editor image) and publishing to the web.
import { BASE, editorHas, email, register, setup } from './lib.mjs';

const t = await setup('templates, uploads & publishing');

// A 1×1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const MARKDOWN = `# Roadmap

Ship **offline** mode first.

## Later

- [ ] Write the docs
- [x] Pick a name

\`\`\`js
console.log('hi');
\`\`\`
`;

// The embed's player is a third-party page: answer it locally.
const stubPlayer = (ctx) =>
  ctx.route(/youtube-nocookie\.com/, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>player</p>' }),
  );

const eventually = async (check, what) => {
  for (let i = 0; i < 40; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timed out waiting for ${what}`);
};

await t.run(async () => {
  const A = await t.newUser('A');
  const { page } = A;
  await register(page, 'Hydra Basak', email('tpl'));
  await stubPlayer(A.ctx);
  const title = () => page.locator('textarea[aria-label="Page title"]').inputValue();
  const openTemplates = async () => {
    await page.locator('aside button', { hasText: 'Templates' }).click();
    await page.waitForSelector('[role=dialog] >> text=Start from a template');
  };

  await openTemplates();
  await page.waitForTimeout(400); // let the dialog settle for the screenshot
  await t.shot(page, '60-templates');
  await page.locator('[role=dialog] button', { hasText: 'Shared grocery list' }).click();
  await eventually(async () => (await title()) === 'Groceries', 'the Groceries page');
  await editorHas(page, 'Bananas');
  const todos = await page.locator('.bn-editor [data-content-type=checkListItem]').count();
  if (todos < 5) throw new Error(`expected the grocery checklist, got ${todos} items`);
  t.log('a page from a template');

  await openTemplates();
  await page.locator('[role=dialog] button', { hasText: 'Task board' }).click();
  await page.waitForSelector('th >> text=Status');
  for (const name of ['Plan the launch', 'Write the announcement', 'Set up analytics'])
    await page.waitForSelector(`tbody input[value="${name}"]`);
  t.log('a database from a template, with example rows');

  await openTemplates();
  await page.setInputFiles('input[aria-label="Markdown file"]', {
    name: 'roadmap.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(MARKDOWN),
  });
  await eventually(async () => (await title()) === 'Roadmap', 'the imported page');
  await editorHas(page, 'Ship offline mode first.');
  await page.waitForSelector('.bn-editor strong >> text=offline');
  await page.waitForSelector('.bn-editor [data-content-type=heading] >> text=Later');
  await page.waitForSelector('.bn-editor [data-content-type=checkListItem] >> text=Write the docs');
  await page.waitForSelector('.bn-editor [data-content-type=codeBlock]');
  t.log('a Markdown file becomes a page: title, bold, headings, to-dos, code');

  // /embed: paste a link, get a player
  await page.click('.bn-editor >> text=Ship offline mode first.');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/embed');
  await page.getByRole('option', { name: /^Embed YouTube/ }).click();
  await page.fill('input[aria-label="Link to embed"]', 'https://youtu.be/dQw4w9WgXcQ');
  await page.keyboard.press('Enter');
  await page.waitForSelector(
    '.folium-embed iframe[src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"]',
  );
  t.log('/embed turns a YouTube link into a player');

  // an image block, uploaded from the computer
  await page.click('.bn-editor >> text=Ship offline mode first.');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/image');
  await page.getByRole('option', { name: /^Image/ }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('[data-test=upload-input]'),
  ]);
  await chooser.setFiles({ name: 'chart.png', mimeType: 'image/png', buffer: PNG });
  const img = page.locator('.bn-editor img[src^="/uploads/"]');
  await img.waitFor();
  const res = await page.request.get(`${BASE}${await img.getAttribute('src')}`);
  if (res.status() !== 200 || res.headers()['content-type'] !== 'image/png')
    throw new Error(`uploaded image: ${res.status()} ${res.headers()['content-type']}`);
  if (!(await res.body()).equals(PNG)) throw new Error('the uploaded bytes changed');
  t.log('an image uploads from the editor and is served back');

  // cover image upload
  await page.getByRole('button', { name: 'Add cover' }).click();
  await page.hover('.group\\/cover');
  await page.getByRole('button', { name: 'Change cover' }).click();
  await page.setInputFiles('input[type=file][accept^="image/png"]', {
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await page.waitForFunction(() =>
    /\/uploads\/[a-f0-9]{32}\.png/.test(
      document.querySelector('.group\\/cover')?.getAttribute('style') ?? '',
    ),
  );
  t.log('a cover image uploads too');

  // publish to the web
  await page.getByRole('button', { name: 'Share' }).click();
  await page.getByRole('switch', { name: 'Publish to web' }).click();
  const linkInput = page.locator('input[aria-label="Public link"]');
  await linkInput.waitFor();
  const link = await linkInput.inputValue();
  if (!new RegExp(`^${BASE}/s/[A-Za-z0-9_-]{22}$`).test(link)) throw new Error(`link: ${link}`);
  await page.getByRole('button', { name: 'Copy', exact: true }).click();
  await page.waitForSelector('text=Public link copied');
  if ((await page.evaluate(() => navigator.clipboard.readText())) !== link)
    throw new Error('the public link was not copied');
  await t.shot(page, '61-publish');
  t.log('Share → Publish to web gives a public link');

  // the server has the latest blocks before a visitor opens the link
  const token = link.split('/s/')[1];
  await eventually(async () => {
    const body = await (await page.request.get(`${BASE}/api/public/${token}`)).text();
    return body.includes('"embed"') && body.includes('/uploads/');
  }, 'the published blocks');

  const V = await t.newUser('visitor');
  await stubPlayer(V.ctx);
  await V.page.goto(link);
  await V.page.waitForSelector('h1 >> text=Roadmap');
  await editorHas(V.page, 'Ship offline mode first.');
  await V.page.waitForSelector('.bn-editor strong >> text=offline');
  await V.page.waitForSelector('.folium-embed iframe[src*="youtube-nocookie.com/embed/"]');
  await V.page.waitForSelector('.bn-editor img[src^="/uploads/"]');
  await V.page.waitForSelector('text=Published with');
  if ((await V.page.getAttribute('.bn-editor', 'contenteditable')) !== 'false')
    throw new Error('the published page should be read-only');
  if ((await V.page.title()) !== 'Roadmap · Folium') throw new Error(await V.page.title());
  await t.shot(V.page, '62-published');
  t.log('anyone can read the published page, without an account');

  await page.getByRole('switch', { name: 'Publish to web' }).click();
  await linkInput.waitFor({ state: 'detached' });
  await V.page.reload();
  await V.page.waitForSelector('text=This page isn’t published');
  t.log('unpublishing takes the page down');
});
