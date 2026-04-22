# Folium

A **full-stack, multi-user Notion-like backend + frontend monorepo** built with **TypeScript** using **npm workspaces**.

- **Client:** React + Vite (port `5173`)
- **Server:** Express + TypeScript (port `3001`)
- **Database:** MongoDB (Mongoose)
- **Cache:** Redis
- **Core features:** Auth (JWT + refresh tokens), Workspaces (roles), Pages, Blocks (stored as separate DB records)

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

### Pages
- `POST /api/workspaces/:workspaceId/pages` (owner/editor)
- `GET /api/workspaces/:workspaceId/pages` (member)

### Blocks
Blocks are stored as **separate MongoDB records** (Notion-style building block approach).

- `POST /api/pages/:pageId/blocks` (owner/editor)
- `GET /api/pages/:pageId/blocks` (member)

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
- Express
- MongoDB + Mongoose
- Redis
- React + Vite
- ESLint + Prettier
- npm workspaces

---

## Notes

- For a production-grade repo, do not commit build output (e.g. `dist/`) and run builds in CI/CD instead.
- This project is designed to grow into a larger Notion-like system (block reordering, moving blocks, page trees, sharing, real-time collaboration, etc.).

---

## License

Apache-2.0
