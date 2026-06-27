# FINAL_AUDIT.md — Sarda Catalog: Blink → Fastify/SQLite migration

> Final production-validation audit for the migration of the Sarda (سردا) product
> catalog PWA off the Blink platform onto a self-hosted Fastify + SQLite backend.

---

## 1. Completed work (phases)

| Phase | Deliverable | Status |
|---|---|---|
| 1 | Full architecture audit (`PROJECT_AUDIT.md`) | ✅ |
| 2 | Folder scaffolding + `MIGRATION_PLAN.md` | ✅ |
| 3 | Backend foundation: Fastify + SQLite, auto-init, `GET /health` | ✅ |
| 4 | Read API: `GET /products`, `GET /products/:id` | ✅ |
| 5 | Data migration tool (Blink → SQLite + local images), idempotent | ✅ (later removed in 11) |
| 6 | Frontend catalog switched to the API (offline fallback kept) | ✅ |
| 7 | Admin API: create / update / delete / visibility / order | ✅ |
| 8 | Image upload `POST /upload` + validation + lifecycle cleanup | ✅ |
| 9 | Admin frontend switched to the API (+ shared API client) | ✅ |
| 10 | Product detail page switched to the API (offline fallback) | ✅ |
| 11 | Removed Blink SDK, migration code, dead code, unused deps | ✅ |
| 12 | Performance: memoization, prepared statements, image hints | ✅ |
| 13 | Production validation + this audit | ✅ |

### Bugs fixed along the way
- **Service worker served a stale empty product list** after mutations (cache-first
  for all non-`/api` GETs). Now **network-first** for API requests with cache fallback
  for offline; cache bumped to `v2`. (Phase 9)
- **Hydration mismatch on `/admin`** — the unlock guard read `sessionStorage` during the
  client's first render but not the server's. Now gated on `isClient` so both render the
  same output before mount. (Phase 13)
- API requests use `cache: 'no-store'` (mutable resource). (Phase 9)

### Post-release hardening (final pass)
- **Transactions:** `ProductsService.reorder(items[])` applies all sortOrder changes in one
  transaction; new atomic `PATCH /products/reorder` (admin sends one batch, not two updates).
- **Security headers:** `@fastify/helmet` (nosniff, etc.); CSP off for this JSON/image API and
  `Cross-Origin-Resource-Policy: cross-origin` so images load across origins.
- **Upload content sniffing:** rejects a spoofed Content-Type/extension whose bytes aren't a
  real JPEG/PNG/WEBP/GIF.
- **Accessibility:** `aria-label`s on all icon-only controls; admin list error state with retry.
- **Documentation:** full `docs/` set; accurate root README; removed obsolete files.
- **Cleanup:** removed empty Phase-2 scaffolding folders and redundant planning READMEs.

---

## 2. Architecture (final)

```
Two Android tablets (PWA, offline-first)
        │  HTTPS (VITE_API_URL)
        ▼
┌──────────────────────────────┐         ┌─────────────────────────────┐
│ Frontend (static, prerendered)│        │ Backend: Fastify (Node 22)   │
│ React 19 + TanStack Start/Router        │  GET  /health                │
│ • catalog / search / categories         │  GET  /products[/:id]        │
│ • product detail                         │  POST /products              │
│ • admin panel (CRUD)                     │  PUT  /products/:id          │
│ • PIN gate (client-side)                 │  DELETE /products/:id        │
│ • IndexedDB offline cache                │  PATCH /products/:id/visibility│
│ • service worker (network-first API)     │  PATCH /products/:id/order   │
│                                          │  POST /upload (multipart)    │
│ src/api/ shared client ──────────────────▶ GET  /uploads/products/<f>  │
└──────────────────────────────┘         │                              │
                                          │  ProductsService (all SQL)   │
                                          │  StorageService (image files)│
                                          │         │            │       │
                                          │         ▼            ▼       │
                                          │   SQLite          uploads/   │
                                          │   catalog.db      products/   │
                                          └─────────────────────────────┘
```

- **Frontend:** React 19, TanStack Start (SSR + static prerender → `dist/`), TanStack
  Router (file-based), React Query, framer-motion, Tailwind, `@blinkdotnew/ui` (kept).
  RTL Arabic, PWA (manifest + service worker).
- **Backend:** Fastify 5 on Node 22, **`node:sqlite`** (no native build), `@fastify/cors`,
  `@fastify/multipart`, `@fastify/static`. TypeScript run via `tsx`.
- **Data layer:** one `products` table (12 fields, unchanged from Blink's shape). All SQL
  lives in `ProductsService` (prepared-statement cache); routes contain no SQL.
- **Images:** uploaded to `server/uploads/products/` with unique UUID filenames, served
  statically; URLs stored **relative**, resolved to absolute against the API origin for
  display, stripped back to relative on write.
- **Offline:** IndexedDB product cache + service worker; catalog and product detail render
  from cache when the API is unreachable.

### Database — `products`
`id, name, description, size, cartonQuantity, cartonPrice, imageUrl, category, isHidden,
sortOrder, createdAt, updatedAt` (types: TEXT, with INTEGER `cartonQuantity`/`isHidden`/
`sortOrder` and REAL `cartonPrice`). Indexes on `sortOrder` and `category`. `catalog.db`
auto-creates on first boot.

---

## 3. Validation results (Phase 13)

| Area | Result |
|---|---|
| TypeScript (frontend + server) | ✅ `tsc --noEmit` clean, both |
| Production build | ✅ exit 0, **no warnings**, 4 pages prerendered, `dist/index.html` ready |
| Backend / health / endpoints | ✅ health ok, 404s + 400 validation correct |
| SQLite | ✅ auto-init, 12-column schema |
| Uploads | ✅ upload + static serving + mime/size validation + lifecycle delete |
| Offline mode | ✅ catalog + detail render from cache with API down |
| PWA | ✅ manifest valid, `sw.js` served, service worker registers |
| Search | ✅ |
| Categories | ✅ counts + filtering |
| Product details | ✅ loads from API, offline fallback, not-found |
| Admin CRUD | ✅ create / edit / delete |
| Image upload | ✅ via UI, stored + served, replace deletes old |
| Sorting | ✅ reorder (sortOrder) |
| Visibility | ✅ hide / show (isHidden) |
| Responsive layout | ✅ renders on 390 px mobile viewport |
| Hydration | ✅ no hydration errors on `/`, `/catalog`, `/admin` |
| Security headers | ✅ helmet (nosniff; CORP cross-origin) |
| Atomic reorder | ✅ single-transaction batch |
| Upload content validation | ✅ spoofed payload rejected (400) |
| Accessibility | ✅ icon-only controls have accessible names |

All checks performed via server-level `app.inject` tests and a real Chromium browser against
the live API.

---

## 4. Known limitations

1. **`@blinkdotnew/ui` is still used** for the app provider, toaster, and theme tokens
   (`__root.tsx`, admin toasts, `index.css`). Only the Blink **SDK** (`@blinkdotnew/sdk`)
   was removed. Replacing the UI library (e.g. with `react-hot-toast` + local tokens) is a
   separate, larger effort and was intentionally deferred to avoid UI regressions.
2. **Authentication is a client-side PIN gate only** (`localStorage`, plaintext compare).
   It deters casual access on a shared tablet; it is **not** real security. The API has no
   auth and is reachable by anyone who can reach it — keep it on a trusted network.
3. **Lint tooling is incomplete:** `eslint` is not installed (no config) and the two CSS
   check scripts referenced by `npm run lint` (`scripts/check-css-variables.js`,
   `scripts/check-css-classes.js`) do not exist. TypeScript (`tsc --noEmit`) is the active
   type/lint gate and passes. `npm run lint` should be repaired or trimmed before relying
   on CI lint.
4. **`/settings` is a stub** (`Hello "/settings"!`). PIN/logo management has no UI; PINs
   are the defaults (`1234` / `4321`) unless changed in storage.
5. **Image URL origin:** stored relative and resolved against `VITE_API_URL`. In a
   split-origin deployment `VITE_API_URL` must be set at build time; ideally serve the
   frontend and API from the same origin in production so URLs stay relative.
6. **CORS** defaults to reflecting any origin; set `CORS_ORIGIN` to restrict in production.
7. **Production data migration:** the Blink→SQLite migration tool was removed in Phase 11.
   If a live Blink dataset still needs importing, run the migration from the Phase 5 branch
   **before** decommissioning Blink (this environment's network blocked Blink, so only
   synthetic data was exercised here).

---

## 5. Production checklist

- [ ] Set `VITE_API_URL` to the API origin at build time (or serve same-origin).
- [ ] Run the data migration against live Blink (Phase 5 tooling) if real data exists; verify counts + images.
- [ ] Deploy the Fastify server with a persistent volume for `catalog.db` and `uploads/`.
- [ ] Back up `catalog.db` and `uploads/products/` regularly.
- [ ] Set `CORS_ORIGIN` to the tablet/app origin(s).
- [ ] Put the API behind HTTPS on a trusted network; consider real auth if exposed.
- [ ] Change the default PINs.
- [ ] Build the frontend (`npm run build`) and host `dist/` (SPA fallback `/* → index.html`).
- [ ] Verify the service worker + manifest are served with correct headers.
- [ ] (Optional) Repair `npm run lint` (add eslint/config or trim) and re-chunk the bundle if desired.

---

*Migration complete: the application runs entirely on Fastify + SQLite with local image
storage and offline support. No `@blinkdotnew/sdk` remains.*
