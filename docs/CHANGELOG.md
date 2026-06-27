# Changelog

All notable changes to this project. This release migrates the catalog off the Blink
platform onto a self-hosted Fastify + SQLite backend.

## [1.0.0] — Independent catalog (Blink-free)

### Added
- **Fastify + SQLite backend** (`server/`) on Node 22 using built-in `node:sqlite`
  (no native build). Auto-creates `catalog.db` + the `products` table on boot.
- **Read API:** `GET /health`, `GET /products`, `GET /products/:id`.
- **Admin API:** `POST /products`, `PUT /products/:id`, `DELETE /products/:id`,
  `PATCH /products/:id/visibility`, `PATCH /products/:id/order`, and atomic
  `PATCH /products/reorder`.
- **Image upload:** `POST /upload` (multipart) with mime/extension/size **and magic-byte**
  validation, unique UUID filenames, static serving at `/uploads/products/<file>`, old-image
  deletion on replace, and image deletion when a product is deleted.
- **Shared frontend API client** (`src/api/`) with relative↔absolute image-URL resolution.
- **Security headers** via `@fastify/helmet` (CORP `cross-origin` for image loading).
- **Accessibility:** `aria-label`s on icon-only controls; admin list error state with retry.
- Full documentation set under `docs/`.

### Changed
- Catalog, product detail, and the entire admin panel now read/write via the Fastify API
  (previously Blink). Product JSON shape is unchanged.
- Service worker is **network-first for API requests** (was cache-first for everything),
  fixing stale lists after mutations; cache bumped to `v2`.
- Admin `/admin` no longer triggers a hydration mismatch (unlock guard gated on `isClient`).
- Performance: memoized catalog derivations, cached prepared statements, image
  `loading="lazy"` / `decoding="async"` hints.

### Removed
- `@blinkdotnew/sdk` and `src/blink/`.
- The one-time Blink→SQLite migration tool and its npm scripts.
- The Blink Visual Editor build tagger.
- Dead template code (`Shell`, `AppSidebarShell`, `shared-app-layout`, `useAdminGuard`,
  `lib/backup`).
- 11 unused dependencies (`@react-three/*`, `recharts`, `@dnd-kit/core`, `react-responsive`,
  `date-fns`, `react-hook-form`, `@hookform/resolvers`, `react-hot-toast`, `zod`, `glob`).

### Known limitations
See `KNOWN_LIMITATIONS.md` (notably: `@blinkdotnew/ui` UI library retained; PIN gate is
client-side only).
