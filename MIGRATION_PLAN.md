# MIGRATION_PLAN.md — Exact order for removing Blink

> **Companion to** `PROJECT_AUDIT.md` (full audit) and the scaffolding created in Phase 2
> (`server/**` and `src/{services,api,models}/`).
>
> **This document defines the precise, ordered sequence in which Blink will be removed.**
> Phase 2 (the current phase) only *prepares* the architecture — it removes nothing and
> changes no functionality. Steps below are executed in **later** phases, strictly in order.

## Official target architecture (decided)

Blink will be replaced by a **self-hosted stack** — **not** Supabase or any managed cloud
backend:

- **Fastify** — the HTTP API server (`server/api/`), replacing `blink.db` / `blink.storage`.
- **SQLite** — a single local database file holding the `products` table (`server/database/`).
- **Local uploads folder** — product images stored on disk and served as static files by
  Fastify (`server/storage/`); the served path is the `publicUrl` saved in
  `products.imageUrl`.
- **Offline-first PWA** — the existing client keeps its IndexedDB cache + service worker so
  the catalog works with no connectivity.
- **Automatic synchronization** — the two clients sync with the Fastify/SQLite server in the
  background when online (`server/sync/`); offline edits reconcile on reconnect.
- **Single administrator** — exactly one admin manages the catalog; no multi-user accounts.
- **Two Android tablets** — the only target devices (PWA installed), one of which may also
  act as the admin device.

This deployment is small, local, and single-tenant by design. Authentication stays as the
existing client-side PIN gate (audit §6); no managed-cloud auth is introduced.

## Ground truth (from the audit)

Blink is used in three separable surfaces:

- **Data SDK** — `@blinkdotnew/sdk` → `blink.db` (one `products` table) + `blink.storage`
  (image upload). `blink.auth` is **never used**.
- **UI kit** — `@blinkdotnew/ui` → `BlinkUIProvider`, `Toaster`/`toast`, theme styles,
  plus `AppShell*`/`Avatar`/`Button`/`Tooltip*` used only by **dead** template files.
- **Build tagger** — `blink-tagger.plugin.mjs` (Visual Editor), **off by default**.

The contract to preserve end-to-end: the `Product` shape (`src/types/product.ts`) and the
operations `list({orderBy:{sortOrder}})`, `get`, `create`, `update`, `delete`, and
`upload(file) -> {publicUrl}`. The offline IndexedDB cache and the client-side PIN gate
must keep working unchanged.

---

## Removal order (do NOT reorder these steps)

### Step 0 — Preparation (THIS phase, Phase 2) ✅
- Create `server/{api,database,storage,sync,config}/` and `src/{services,api,models}/`
  with READMEs. **No imports, no behavior change, nothing moved or deleted.**
- Land `PROJECT_AUDIT.md` and this `MIGRATION_PLAN.md`.
- **Exit criterion:** app builds and behaves exactly as before; Blink still 100% live.

### Step 1 — Remove DEAD Blink surfaces (zero behavior change)
Order within the step:
1. Delete unused template files that import `@blinkdotnew/ui`:
   `src/Shell.tsx`, `src/components/AppSidebarShell.tsx`,
   `src/layouts/shared-app-layout.tsx`.
2. Remove the Visual Editor tagger from `vite.config.ts` (the
   `BLINK_BUILD_TIME_TAGGER` branch) and delete `blink-tagger.plugin.mjs`.
3. Remove the unused `src/hooks/useAdminGuard.ts` (or migrate its toast later).
- **Why first:** lowest risk — these are not on any live code path.
- **Exit criterion:** `grep` shows fewer Blink references; no runtime change.

### Step 2 — Replace the Blink UI kit (`@blinkdotnew/ui`)
Order within the step:
1. Port the design tokens currently provided by `@blinkdotnew/ui/styles`
   (`--primary`, `--accent`, `--background`, `--border`, …) directly into
   `src/index.css`; then remove the `@import '@blinkdotnew/ui/styles'`.
2. Replace `BlinkUIProvider` in `src/routes/__root.tsx` with the app's own light-theme
   root wrapper using the ported tokens.
3. Replace `Toaster` + `toast` from `@blinkdotnew/ui` with **`react-hot-toast`**
   (already a dependency) in `__root.tsx`, `admin.tsx`, `AdminProductForm.tsx`.
4. Remove `@blinkdotnew/ui` from `package.json`.
- **Why before data:** UI swap is independent of the backend and de-risks the visual
  layer separately from the data layer.
- **Exit criterion:** no `@blinkdotnew/ui` imports anywhere; RTL/Arabic theme intact.

### Step 3 — Introduce the data-access seam (still Blink-backed)
1. Define the repository interface in `src/services/` (signatures in its README).
2. Implement a **Blink adapter** that wraps existing `blink.db`/`blink.storage` calls.
3. Switch call sites — `useProducts`, `routes/product.$id.tsx`, `routes/admin.tsx`,
   `components/AdminProductForm.tsx` — to use the service instead of `blink` directly.
- **Why now:** centralizes all remaining Blink usage into ONE adapter file with zero
  behavior change, making the final swap atomic.
- **Exit criterion:** `blink.*` appears in exactly one file; all tests/flows unchanged.

### Step 4 — Stand up the replacement backend (**Fastify + SQLite + local uploads**)
1. Scaffold the **Fastify** server (`server/api/`) and **SQLite** database (`server/database/`).
2. Create the `products` table from `server/database/README.md` (preserve every field;
   `isHidden`/`sortOrder` numeric).
3. Create the local uploads folder per `server/storage/README.md` and serve it as static
   files from Fastify (served path becomes `products.imageUrl`).
4. Implement `server/api/` endpoints and `server/config/` env/connection settings.
- **Exit criterion:** Fastify server runs locally; endpoints return `Product`-shaped data.

### Step 5 — Migrate data & images (`server/sync/`)
1. Export products + images from Blink (`list()` or `src/lib/backup.ts`).
2. Copy images into the local uploads folder; capture their served public URLs.
3. Insert rows with `imageUrl` rewritten; preserve `id`, `sortOrder`, `isHidden`,
   `createdAt`, `updatedAt`.
4. Verify row counts and ordering match Blink. **Keep Blink read-only until verified.**
- **Exit criterion:** new backend has identical catalog; deep links (`/product/$id`) work.

### Step 6 — Cut over the frontend
1. Implement the new-backend adapter in `src/services/`, delegating to `src/api/`
   (the HTTP client).
2. Switch the service export from the Blink adapter to the new adapter (one change).
3. Full regression pass: catalog list/search/category counts, product detail, admin
   add/edit/delete/hide/reorder, image upload, **offline reload**, PWA install,
   Arabic number formatting + RTL.
- **Exit criterion:** all flows pass against the new backend; Blink no longer read.

### Step 7 — Remove Blink core
1. Delete `src/blink/client.ts`.
2. Remove `@blinkdotnew/sdk` from `package.json`; remove hardcoded `projectId` /
   `publishableKey`; move config to env via `server/config/` + `VITE_*`.
3. Confirm `grep -ri blink src/` returns only historical comments (if any).
- **Exit criterion:** zero `@blinkdotnew/*` references; build green.

### Step 8 — Cleanup (optional, post-migration)
- Drop genuinely unused deps (`@react-three/*`, `recharts`, `@dnd-kit/core`,
  `react-responsive`, `date-fns`, etc.) after verification.
- Restore/remove the missing `check:css-*` lint scripts so `npm run lint` passes.
- Implement or remove the `/settings` stub; wire `lib/storage.ts` setters + `lib/backup.ts`
  if a settings UI is desired.
- Optionally harden the PIN gate server-side (independent of Blink removal).

---

## Rollback posture
- Each step is independently revertable; Steps 1–3 change no behavior, so they can ship
  separately.
- Blink stays the live source of truth until **Step 6** cutover passes regression — do
  not delete Blink core (Step 7) until then.

## Invariants that must hold at every step
- `Product` shape unchanged (`isHidden`/`sortOrder` numeric).
- Offline IndexedDB cache (`src/lib/offline-db.ts`) keeps functioning.
- Client-side PIN gate (`src/lib/storage.ts`) keeps functioning.
- Arabic/RTL rendering, SEO `<head>`, and PWA (`public/sw.js`, `manifest.json`) intact.
