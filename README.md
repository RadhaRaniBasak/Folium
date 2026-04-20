# Folium

A full-stack TypeScript monorepo powered by **npm workspaces**.

```
folium/
├── apps/
│   ├── client/   → Vite + React + TypeScript (port 5173)
│   └── server/   → Express + TypeScript      (port 3001)
└── packages/
    └── shared/   → Shared types & constants
```

## Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 8

## Setup

### 1. Install all dependencies

```bash
npm install
```

> This installs dependencies for every workspace in one step thanks to npm workspaces.

### 2. Development

Run **both** apps concurrently (each in its own terminal):

```bash
# Terminal 1 – start the API server (hot-reload via tsx watch)
npm run dev --workspace=apps/server

# Terminal 2 – start the Vite dev server
npm run dev --workspace=apps/client
```

Or run all workspaces at once (order not guaranteed):

```bash
npm run dev
```

Visit:
- Client → http://localhost:5173
- Server → http://localhost:3001
- Health  → http://localhost:3001/api/health

### 3. Build

```bash
npm run build
```

Server output lands in `apps/server/dist/`.  
Client output lands in `apps/client/dist/`.

### 4. Lint

```bash
npm run lint
```

### 5. Format

```bash
# Check formatting
npm run format:check

# Apply formatting
npm run format
```

## Workspace structure

| Workspace | Package name | Description |
|---|---|---|
| `packages/shared` | `@repo/shared` | Shared TypeScript types & constants |
| `apps/client` | `@repo/client` | Vite + React frontend |
| `apps/server` | `@repo/server` | Express API backend |

## Path aliases

Both apps can import from `@shared/*` which resolves to `packages/shared/src/*`:

```ts
// works in both client and server
import { APP_NAME, ROUTES } from '@shared/constants';
import type { HealthResponse } from '@shared/types';
```

- **Client** – alias configured in `apps/client/vite.config.ts` and `apps/client/tsconfig.json`.
- **Server** – alias configured in `apps/server/tsconfig.json`; `tsx` resolves paths automatically via TypeScript.

## Tech stack

| Layer | Tools |
|---|---|
| Language | TypeScript 5 (strict mode) |
| Frontend | React 18, Vite 5 |
| Backend | Express 4, tsx (hot-reload) |
| Linting | ESLint 9 (flat config) + `@typescript-eslint` |
| Formatting | Prettier 3 |
| Package manager | npm workspaces |

---

## Deploying: Vercel (client) + Render (server)

This project supports a **double-deploy** setup: the React client on **Vercel** and the Express server on **Render**.

### Server → Render

1. Create a new **Web Service** on [Render](https://render.com) pointing at this repo.
2. Set the following in Render's service settings:

   | Setting | Value |
   |---|---|
   | **Build Command** | `npm install && npm run build --workspace=apps/server` |
   | **Start Command** | `npm run start --workspace=apps/server` |

3. Add these **Environment Variables** in the Render dashboard (all required):

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGO_URI` | MongoDB Atlas connection string (`mongodb+srv://...`) |
   | `REDIS_URL` | Render Redis or Upstash URL (`redis://...` or `rediss://...`) |
   | `JWT_SECRET` | Secure random string ≥ 32 chars (`openssl rand -hex 32`) |
   | `JWT_REFRESH_SECRET` | Different secure random string ≥ 32 chars |
   | `CLIENT_URL` | Your Vercel frontend URL, e.g. `https://folium.vercel.app` |

   > **Note:** `PORT` is set automatically by Render — do **not** add it manually.

### Client → Vercel

1. Import the repo into [Vercel](https://vercel.com).
2. In Vercel project settings, set **Root Directory** to `apps/client`.
3. Leave build settings as defaults (`npm run build`, output `dist`).
4. **Update `apps/client/vercel.json`** — replace the placeholder destination with your actual Render URL:

   ```json
   {
     "rewrites": [
       {
         "source": "/api/(.*)",
         "destination": "https://<your-render-service>.onrender.com/api/$1"
       }
     ]
   }
   ```

   This rewrite forwards all `/api/*` requests from the Vercel-hosted client to the Render server, so no code changes are needed for API calls.

5. Also set `CLIENT_URL` on Render to match your Vercel domain (required for CORS).

### Health check

Once both are deployed, verify the server is running:

```
GET https://<your-render-service>.onrender.com/api/health
```
