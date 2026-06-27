# سردا — كتالوج المنتجات · Sarda Product Catalog

An offline-first, RTL Arabic **product catalog PWA** for Sarda (شركة سردا للتجارة والصناعة),
backed by a self-hosted **Fastify + SQLite** API with local image storage. No operational
dependency on Blink.

## Stack
- **Frontend:** React 19 · TanStack Start (SSR + static prerender) · TanStack Router ·
  React Query · Tailwind · PWA (manifest + service worker) · IndexedDB offline cache.
- **Backend:** Fastify 5 · Node 22 `node:sqlite` (no native build) · `@fastify/{cors,helmet,
  multipart,static}` · TypeScript via `tsx`.

## Quick start

```bash
# 1) API (auto-creates catalog.db on first boot)
npm run server                 # installs server deps, then starts on :4000
#   or:  cd server && npm install && npm run dev

# 2) Frontend (point it at the API)
VITE_API_URL=http://localhost:4000 npm install
VITE_API_URL=http://localhost:4000 npm run dev      # Vite on :3000
```

Open http://localhost:3000 — default PINs: **`1234`** (display) / **`4321`** (admin).

## Build (production)

```bash
VITE_API_URL="<api-origin>" npm run build           # → dist/ (static)
```

Host `dist/` with an SPA fallback (`/* → index.html`). See `docs/DEPLOYMENT.md`.

## Project layout
```
src/            React app (routes, components, hooks, api client, lib)
server/         Fastify + SQLite API (routes, services, database, plugins)
public/         PWA assets (manifest.json, sw.js, icons)
docs/           Architecture, API, database, deployment, guides, etc.
```

## Documentation
Start at **[docs/README.md](./docs/README.md)**. Backend details in `server/SERVER.md`;
final audit in `FINAL_AUDIT.md`.

## Scripts
- `npm run server` — install + start the API
- `npm run dev` — frontend dev server (set `VITE_API_URL`)
- `npm run build` — static production build into `dist/`
- `npm --prefix server run typecheck` · `npx tsc --noEmit` — type checks
