// End-to-end smoke test for the API + real-time relay.
// Start the server (with MongoDB + Redis), then: npm run smoke --workspace=apps/server
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import * as Y from 'yjs';

const BASE = process.env.API_URL ?? 'http://localhost:3001';
const stamp = Date.now();

async function api(token, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...json };
}

const ok = (r, label) => {
  assert.ok(r.success, `${label} failed: ${r.status} ${r.message}`);
  return r.data;
};

// --- auth
const a = ok(
  await api(null, 'POST', '/api/auth/register', {
    name: 'Ada',
    email: `ada${stamp}@t.io`,
    password: 'password123',
  }),
  'register A',
);
const b = ok(
  await api(null, 'POST', '/api/auth/register', {
    name: 'Bo',
    email: `bo${stamp}@t.io`,
    password: 'password123',
  }),
  'register B',
);
const c = ok(
  await api(null, 'POST', '/api/auth/register', {
    name: 'Cy',
    email: `cy${stamp}@t.io`,
    password: 'password123',
  }),
  'register C',
);

// --- workspace + pages
const { workspace } = ok(
  await api(a.accessToken, 'POST', '/api/workspaces', { name: "Ada's Workspace" }),
  'create ws',
);
const W = workspace._id;
const root = ok(
  await api(a.accessToken, 'POST', `/api/workspaces/${W}/pages`, { title: '' }),
  'create untitled',
).page;
assert.equal(root.title, '');
const child = ok(
  await api(a.accessToken, 'POST', `/api/workspaces/${W}/pages`, {
    title: 'Child',
    parent: root._id,
  }),
  'create child',
).page;
assert.equal(child.parent, root._id);
const second = ok(
  await api(a.accessToken, 'POST', `/api/workspaces/${W}/pages`, { title: 'Second' }),
  'create second',
).page;
assert.ok(second.order > root.order, 'orders increase');

let r = await api(a.accessToken, 'PATCH', `/api/pages/${root._id}`, {
  title: 'Roadmap',
  icon: '🚀',
  coverImage: 'gradient:dusk',
  font: 'serif',
  fullWidth: true,
});
const patched = ok(r, 'patch').page;
assert.equal(patched.title, 'Roadmap');
assert.equal(patched.icon, '🚀');
assert.equal(patched.font, 'serif');
assert.equal(patched.fullWidth, true);
r = await api(a.accessToken, 'PATCH', `/api/pages/${root._id}`, {
  coverImage: 'javascript:alert(1)',
});
assert.equal(r.status, 400, 'bad cover rejected');
r = await api(a.accessToken, 'PATCH', `/api/pages/${root._id}`, { parent: child._id });
assert.equal(r.status, 400, 'cycle rejected');
ok(
  await api(a.accessToken, 'PATCH', `/api/pages/${child._id}`, { parent: null }),
  'move child to root',
);
ok(
  await api(a.accessToken, 'PATCH', `/api/pages/${child._id}`, { parent: root._id }),
  'move child back',
);

const fav = ok(
  await api(a.accessToken, 'POST', `/api/pages/${root._id}/favorite`),
  'favorite',
).page;
assert.equal(fav.isFavorite, true);

// --- block snapshot + search
const blocks = [
  {
    id: 'b1',
    type: 'heading',
    props: { level: 1 },
    content: [{ type: 'text', text: 'Quarterly plan', styles: {} }],
    children: [],
  },
  {
    id: 'b2',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'Ship the realtime editor ', styles: {} },
      { type: 'link', href: 'https://x.io', content: [{ type: 'text', text: 'docs', styles: {} }] },
    ],
    children: [
      {
        id: 'b3',
        type: 'checkListItem',
        props: { checked: true },
        content: [{ type: 'text', text: 'Write the PRD', styles: {} }],
        children: [],
      },
    ],
  },
];
const snap = ok(
  await api(a.accessToken, 'PUT', `/api/pages/${root._id}/blocks`, { blocks }),
  'replace blocks',
);
assert.equal(snap.count, 3);
const top = ok(
  await api(a.accessToken, 'GET', `/api/pages/${root._id}/blocks`),
  'list blocks',
).blocks;
assert.equal(top.length, 2, 'two top-level blocks');
const found = ok(
  await api(a.accessToken, 'GET', `/api/workspaces/${W}/search?q=realtime`),
  'search',
).results;
assert.equal(found.length, 1);
assert.match(found[0].snippet, /realtime editor docs/);
const byTitle = ok(
  await api(a.accessToken, 'GET', `/api/workspaces/${W}/search?q=road`),
  'search title',
).results;
assert.equal(byTitle[0]._id, root._id);

// --- duplicate
const dup = ok(
  await api(a.accessToken, 'POST', `/api/pages/${root._id}/duplicate`),
  'duplicate',
).page;
assert.equal(dup.title, 'Roadmap (copy)');
assert.ok(dup.order > root.order && dup.order < second.order, 'copy sits right after the original');
const dupBlocks = ok(
  await api(a.accessToken, 'GET', `/api/pages/${dup._id}/blocks`),
  'dup blocks',
).blocks;
assert.equal(dupBlocks.length, 2);

// --- sharing
r = await api(a.accessToken, 'POST', `/api/workspaces/${W}/members`, {
  email: `bo${stamp}@t.io`,
  role: 'editor',
});
ok(r, 'invite B');
r = await api(a.accessToken, 'POST', `/api/workspaces/${W}/members`, {
  email: `cy${stamp}@t.io`,
  role: 'viewer',
});
ok(r, 'invite C');
r = await api(a.accessToken, 'POST', `/api/workspaces/${W}/members`, {
  email: `nobody${stamp}@t.io`,
  role: 'viewer',
});
assert.equal(r.status, 404, 'unknown email');
const detail = ok(await api(b.accessToken, 'GET', `/api/workspaces/${W}`), 'ws detail').workspace;
assert.ok(
  detail.members.some((m) => m.user.name === 'Bo' && m.role === 'editor'),
  'members populated',
);
const listB = ok(await api(b.accessToken, 'GET', `/api/workspaces/${W}/pages`), 'B lists').pages;
assert.equal(listB.length, 4);
assert.equal(listB.find((p) => p._id === root._id).isFavorite, false, 'favorites are per user');
r = await api(c.accessToken, 'PATCH', `/api/pages/${root._id}`, { title: 'hacked' });
assert.equal(r.status, 403, 'viewer cannot edit');

// --- trash / restore / delete forever
ok(await api(a.accessToken, 'DELETE', `/api/pages/${root._id}`), 'trash');
let list = ok(await api(a.accessToken, 'GET', `/api/workspaces/${W}/pages`), 'list').pages;
assert.ok(!list.some((p) => p._id === root._id || p._id === child._id), 'subtree hidden');
const trash = ok(
  await api(a.accessToken, 'GET', `/api/workspaces/${W}/pages?trash=1`),
  'trash list',
).pages;
assert.equal(trash.length, 2);
ok(await api(a.accessToken, 'POST', `/api/pages/${root._id}/restore`), 'restore');
list = ok(await api(a.accessToken, 'GET', `/api/workspaces/${W}/pages`), 'list').pages;
assert.equal(list.length, 4, 'subtree restored');
r = await api(a.accessToken, 'DELETE', `/api/pages/${second._id}/permanent`);
assert.equal(r.status, 400, 'must trash first');
ok(await api(a.accessToken, 'DELETE', `/api/pages/${second._id}`), 'trash second');
ok(await api(a.accessToken, 'DELETE', `/api/pages/${second._id}/permanent`), 'delete forever');

// --- realtime
function connect(token) {
  return new Promise((resolve, reject) => {
    const s = io(BASE, { auth: { token }, transports: ['websocket'] });
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
}
const join = (s, pageId, clientId) =>
  new Promise((resolve) => s.emit('doc:join', pageId, clientId, resolve));
const nextEvent = (s, ev) => new Promise((resolve) => s.once(ev, (...args) => resolve(args)));

await assert.rejects(connect('not-a-token'), /unauthorized/);
const sa = await connect(a.accessToken);
const sb = await connect(b.accessToken);
const sc = await connect(c.accessToken);
const sx = await connect(
  ok(
    await api(null, 'POST', '/api/auth/register', {
      name: 'X',
      email: `x${stamp}@t.io`,
      password: 'password123',
    }),
    'reg X',
  ).accessToken,
);

const docA = new Y.Doc();
const docB = new Y.Doc();
const ja = await join(sa, root._id, docA.clientID);
assert.equal(ja.ok, true);
assert.equal(ja.role, 'owner');
const jb = await join(sb, root._id, docB.clientID);
assert.equal(jb.role, 'editor');
const jc = await join(sc, root._id, 1234);
assert.equal(jc.role, 'viewer');
const jx = await join(sx, root._id, 999);
assert.equal(jx.ok, false, 'outsider cannot join');

docA.on('update', (u, origin) => {
  if (origin !== 'remote') sa.emit('doc:update', root._id, u);
});
const gotB = nextEvent(sb, 'doc:update');
docA.getText('t').insert(0, 'hello from A');
const [pid, upd] = await gotB;
assert.equal(pid, root._id);
Y.applyUpdate(docB, new Uint8Array(upd), 'remote');
assert.equal(docB.getText('t').toString(), 'hello from A');

// viewer updates are dropped
let leaked = false;
sa.once('doc:update', () => {
  leaked = true;
});
const docC = new Y.Doc();
docC.getText('t').insert(0, 'viewer edit');
sc.emit('doc:update', root._id, Y.encodeStateAsUpdate(docC));
await new Promise((res) => setTimeout(res, 300));
assert.equal(leaked, false, 'viewer update not relayed');

// persisted state on rejoin
await new Promise((res) => setTimeout(res, 300));
const sb2 = await connect(b.accessToken);
const rejoin = await join(sb2, root._id, 42);
const fresh = new Y.Doc();
Y.applyUpdate(fresh, new Uint8Array(rejoin.state));
assert.equal(fresh.getText('t').toString(), 'hello from A', 'state persisted');

// awareness removal on disconnect
const removed = nextEvent(sa, 'awareness:remove');
sb2.disconnect();
const [rpid, ids] = await removed;
assert.equal(rpid, root._id);
assert.deepEqual(ids, [42]);

// workspace room gets pages:changed
await new Promise((resolve) => sb.emit('workspace:join', W, resolve));
const changed = nextEvent(sb, 'pages:changed');
ok(
  await api(a.accessToken, 'PATCH', `/api/pages/${child._id}`, { title: 'Child renamed' }),
  'rename',
);
const [payload] = await changed;
assert.equal(payload.pageId, child._id);

// duplicate copies the Yjs doc too
const dup2 = ok(
  await api(a.accessToken, 'POST', `/api/pages/${root._id}/duplicate`),
  'duplicate again',
).page;
const jd = await join(sa, dup2._id, 7);
const dupDoc = new Y.Doc();
Y.applyUpdate(dupDoc, new Uint8Array(jd.state));
assert.equal(dupDoc.getText('t').toString(), 'hello from A', 'yjs doc duplicated');

[sa, sb, sc, sx].forEach((s) => s.disconnect());
console.log('ALL SMOKE TESTS PASSED');
process.exit(0);
