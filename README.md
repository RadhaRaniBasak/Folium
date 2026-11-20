# Folium

A **full-stack, real-time, Notion-style workspace** built with **TypeScript** using **npm workspaces**.

- **Client:** React + Vite, BlockNote editor, Tailwind CSS v4, Motion
- **Server:** Express + TypeScript (port `3001`), Socket.io
- **Real-time:** Yjs CRDT documents synced over Socket.io (Redis adapter for multiple instances)
- **Database:** MongoDB (Mongoose) · **Cache:** Redis
- **Core features:** Auth (JWT + refresh tokens), Workspaces (roles), Pages, Blocks (stored as separate DB records)

## Features

**Editor:** slash menu, headings, to-dos, toggles, tables, code blocks, quotes, images/video/files by link,
markdown shortcuts, drag-to-reorder blocks, text colours and links.

**Pages:** nested pages in a sidebar tree (drag to reorder or nest), emoji icons, gradient or image covers,
favorites, breadcrumbs, duplicate, rename, trash with undo / restore / delete forever, full-width and
serif / mono page styles, Markdown export, word count.

**Collaboration:** live co-editing with named cursors, presence avatars, offline edits that sync on
reconnect, live sidebar updates, invites by email with owner / editor / viewer roles.

**Navigation & polish:** ⌘K command palette (searches titles and page content), keyboard shortcuts
(⌘\ sidebar, ⌘⇧L dark mode, ⌘⌥N new page), dark mode, spring animations, subtle UI sounds, a seeded
"Getting started" page for new users.

## How real-time sync works

Each page is a Yjs document. The server (`apps/server/src/realtime/collab.ts`) is a stateless relay: it
authenticates the socket with the access token, checks the user's role on `doc:join`, forwards updates
and cursor awareness to everyone in the page's room, and appends every update to the `DocUpdate`
collection (merged and compacted when a client joins). Viewers can't send updates. Clients autosave a
JSON snapshot to `PUT /api/pages/:pageId/blocks`, which keeps the block records and full-text search
up to date.

---

## Repo structure

```
folium/
├── apps/
│   ├── client/   → Vite + React + TypeScript
│   └── server/   → Express + TypeScript API
└── packages/
    └── shared/   → Shared types/constants
```

---

## Prerequisites

- Node.js >= 18
- npm >= 8
- Docker (recommended for MongoDB + Redis)

---

## Environment variables

Create a `.env` file in the repo root (or copy from `.env.example` if you have one):

Example values:

```bash
NODE_ENV=development
PORT=3001
CLIENT_URL=http://localhost:5173

MONGO_URI=mongodb://localhost:27017/folium
REDIS_URL=redis://localhost:6379

JWT_SECRET=replace-with-a-long-random-secret
JWT_REFRESH_SECRET=replace-with-a-different-long-random-secret
```

---

## Run MongoDB + Redis (Docker)

From repo root:

```bash
docker-compose up -d
```

This starts:
- MongoDB on `localhost:27017`
- Redis on `localhost:6379`

---

## Install dependencies

From repo root:

```bash
npm install
```

---

## Run the project (development)

### Server (Terminal 1)

```bash
npm run dev --workspace=apps/server
```

### Client (Terminal 2)

```bash
npm run dev --workspace=apps/client
```

Open:
- Client: `http://localhost:5173`
- API health check: `http://localhost:3001/api/health`

---

## Scripts

From repo root:

```bash
npm run dev
npm run build
npm run lint
npm run format
npm run format:check
```

---

## API Overview

### Health
- `GET /api/health`

### Auth (`/api/auth`)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me` (requires Bearer token)

### Workspaces (`/api/workspaces`)
- `POST /api/workspaces` (auth)
- `GET /api/workspaces` (auth)
- `GET /api/workspaces/:workspaceId` (member)
- `POST /api/workspaces/:workspaceId/members` (owner)
- `PATCH /api/workspaces/:workspaceId/members/:userId` (owner)
- `DELETE /api/workspaces/:workspaceId/members/:userId` (owner)

**Roles**
- `owner`: full access
- `editor`: can create/update content
- `viewer`: read-only

`POST /api/workspaces/:workspaceId/members` accepts `{ email, role }` (or `{ userId, role }`).

### Pages
- `POST /api/workspaces/:workspaceId/pages` (owner/editor) — `{ title?, parent?, icon? }`
- `GET /api/workspaces/:workspaceId/pages` (member) — add `?trash=1` for the trash
- `GET /api/workspaces/:workspaceId/search?q=` (member) — titles + page content, with snippets
- `GET /api/pages/:pageId` (member) — page + your role
- `PATCH /api/pages/:pageId` (owner/editor) — title, icon, coverImage, font, fullWidth, parent, order
- `POST /api/pages/:pageId/favorite` (member) — per-user favorite toggle
- `POST /api/pages/:pageId/duplicate` (owner/editor)
- `DELETE /api/pages/:pageId` (owner/editor) — moves the page and its subpages to the trash
- `POST /api/pages/:pageId/restore` (owner/editor)
- `DELETE /api/pages/:pageId/permanent` (owner/editor) — only from the trash

### Blocks
Blocks are stored as **separate MongoDB records** (Notion-style building block approach).

- `POST /api/pages/:pageId/blocks` (owner/editor)
- `GET /api/pages/:pageId/blocks` (member)
- `PUT /api/pages/:pageId/blocks` (owner/editor) — replace with the editor's current document

### Socket.io events
`workspace:join` / `workspace:leave`, `doc:join` / `doc:leave`, `doc:update`, `doc:sync`,
`awareness:update` / `awareness:query`; the server emits `pages:changed` to a workspace and
`awareness:remove` when someone leaves a page.

## Smoke test

With the server running against a local MongoDB + Redis:

```bash
npm run smoke --workspace=apps/server
```

It registers users and checks pages, trash, search, sharing, roles and the real-time relay end to end.

## Deploying the client separately

When the client and API are on different origins (e.g. Vercel + Render), set `VITE_SOCKET_URL` to the
API's URL at build time so Socket.io connects to it directly. Vercel rewrites can't proxy WebSockets.

---

## Postman quick test (recommended)

Create a Postman environment with:

- `baseUrl = http://localhost:3001`
- `accessToken` (filled after login)
- `workspaceId` (filled after create workspace)
- `pageId` (filled after create page)

Suggested flow:
1. Register
2. Login → save `accessToken`
3. Create workspace → save `workspaceId`
4. Create page → save `pageId`
5. Create block
6. List blocks

---

## Tech stack

- TypeScript (strict)
- Express + Socket.io (Redis adapter)
- Yjs (CRDT) + BlockNote
- MongoDB + Mongoose
- Redis
- React + Vite, Tailwind CSS v4, Motion
- ESLint + Prettier
- npm workspaces

---

## Notes

- For a production-grade repo, do not commit build output (e.g. `dist/`) and run builds in CI/CD instead.
- Next ideas: page mentions/backlinks, comments, version history, templates and database views.

---

## License

Apache-2.0
