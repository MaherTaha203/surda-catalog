# Release Notes — v1.0.0 (Independent Catalog)

The Sarda (سردا) product catalog is now **fully independent of the Blink platform**. Data and
images are served by a self-hosted **Fastify + SQLite** backend with local image storage,
while the offline-first PWA experience is unchanged for users.

## Highlights
- **Self-hosted backend** — Fastify on Node 22 with built-in `node:sqlite` (no native deps),
  auto-initializing `catalog.db` and the `products` table.
- **Full catalog + admin over a real API** — browse, search, filter by category, view product
  details; admins create, edit, hide/show, reorder, and delete products with image upload.
- **Local image storage** — uploads validated (type/extension/size **and content**) and
  served from `/uploads/products/`; replacing or deleting a product cleans up its image.
- **Offline-first** — the catalog and product details remain usable without a connection via
  the IndexedDB cache and a network-first service worker.
- **Hardening** — security headers, atomic reorder (transaction), and accessibility labels.
- **Leaner** — the Blink SDK, migration code, dead code, and 11 unused dependencies removed;
  warning-free production build.

## Upgrade / deploy notes
- Build the frontend with `VITE_API_URL` pointing at the API (or `""` for same-origin).
- Deploy the API with a persistent volume for `catalog.db` and `uploads/`; put it behind
  HTTPS and restrict `CORS_ORIGIN`.
- Change the default PINs (`1234` display / `4321` admin).
- If importing a live Blink dataset, run the migration before decommissioning Blink.

See `docs/DEPLOYMENT.md` for full instructions and `docs/KNOWN_LIMITATIONS.md` for caveats.

## Known limitations
`@blinkdotnew/ui` (UI components only) is still used; authentication is a client-side PIN
gate; `/settings` is a stub. Details in `docs/KNOWN_LIMITATIONS.md`.
