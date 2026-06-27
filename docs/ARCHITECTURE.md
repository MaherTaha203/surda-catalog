# Architecture

Sarda (سردا) is an offline-first, RTL Arabic **product catalog PWA** for cleaning
materials and tools, backed by a self-hosted Fastify + SQLite API. It no longer depends
on the Blink platform for data or storage.

## High-level

```
Two Android tablets (installed PWA)        ┌──────────────────────────────┐
┌───────────────────────────────┐         │ Backend — Fastify (Node 22)  │
│ Frontend (static, prerendered) │  HTTPS  │  /health                     │
│ React 19 + TanStack Start      │ ───────▶│  /products  (GET, POST)      │
│ Router + React Query           │ VITE_   │  /products/:id (GET,PUT,DEL) │
│ • PIN gate (client-side)       │ API_URL │  /products/:id/visibility    │
│ • catalog / search / category  │         │  /products/:id/order         │
│ • product detail               │         │  /products/reorder (atomic)  │
│ • admin panel (CRUD)           │         │  /upload (multipart)         │
│ • IndexedDB offline cache      │ ◀───────│  /uploads/products/<file>    │
│ • service worker (PWA)         │ images  │                              │
│ src/api/ shared client ────────┼────────▶│ ProductsService  StorageSvc  │
└───────────────────────────────┘         │   (all SQL)      (image fs)   │
                                           │       │             │         │
                                           │     SQLite       uploads/     │
                                           │   catalog.db     products/    │
                                           └──────────────────────────────┘
```

## Frontend

- **React 19** + **TanStack Start** (SSR + static prerender → `dist/`) + **TanStack Router**
  (file-based routes in `src/routes/`).
- **React Query** for server state; **framer-motion** for animation; **Tailwind** for styling;
  **`@blinkdotnew/ui`** for the app provider, toaster, and theme tokens (the only remaining
  Blink package — UI only, no data SDK).
- **Data access** is centralized in `src/api/`:
  - `client.ts` — base URL (`VITE_API_URL`), `apiRequest` (JSON, `cache: no-store`), and
    image-URL resolution (stored relative ↔ displayed absolute).
  - `products.ts` — typed functions: `listProducts`, `getProduct`, `createProduct`,
    `updateProduct`, `deleteProduct`, `setProductVisibility`, `setProductOrder`,
    `reorderProducts`, `uploadProductImage`.
- **Offline:** product lists/details are cached in IndexedDB (`src/lib/offline-db.ts`); a
  service worker (`public/sw.js`) is network-first for the API and cache-first for assets.
- **Access:** a client-side PIN gate (`src/lib/storage.ts`) — a display PIN to view, an
  admin PIN to manage. This is a soft gate, not real authentication (see KNOWN_LIMITATIONS).

### Routes
| Path | Purpose |
|---|---|
| `/` | PIN gate / landing |
| `/catalog` | Product grid: search + category tabs |
| `/product/$id` | Product detail + image viewer |
| `/admin` | Admin panel (CRUD, visibility, reorder, image upload) |
| `/settings` | Stub (not implemented) |

## Backend

- **Fastify 5** on **Node 22**, TypeScript run via **tsx** (no compile step to start).
- **SQLite** via Node's built-in **`node:sqlite`** — no native module to build.
- Plugins: `@fastify/cors`, `@fastify/helmet` (security headers), `@fastify/multipart`
  (uploads), `@fastify/static` (image serving).
- **Layering:** routes validate/parse and orchestrate; **`ProductsService`** owns all SQL
  (prepared-statement cache + a transaction helper); **`StorageService`** owns image files
  (validation, write, delete). No SQL lives in route handlers.
- **Auto-init:** on boot `catalog.db` and the `products` table (+ indexes) are created if
  missing (idempotent).

## Data flow examples

- **Catalog load:** `useProducts` → `listProducts()` → `GET /products` → React Query cache
  + IndexedDB cache. Offline → IndexedDB fallback.
- **Create product with image:** admin form → `uploadProductImage(file)` → `POST /upload`
  (validated, stored, returns `/uploads/products/<uuid>.<ext>`) → `createProduct({…,imageUrl})`
  → `POST /products`.
- **Reorder:** admin arrows → `reorderProducts([{id,sortOrder}…])` → `PATCH /products/reorder`
  applied in a single transaction.

See `API.md`, `DATABASE.md`, and `DEPLOYMENT.md` for specifics.
