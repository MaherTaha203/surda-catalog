# PROJECT_AUDIT.md — Phase 1: Full Architecture Audit

> **Repository:** `surda-catalog` (Sarda / سردا product catalog PWA)
> **Audit type:** Read-only architecture audit. No code was modified.
> **Goal of this document:** Fully describe the project as it exists today, map every dependency on the Blink platform, and define a safe migration path to remove Blink without losing functionality.

---

## 1. Project overview

### What the app is
A **mobile-first, RTL Arabic product catalog** for "شركة سردا للتجارة والصناعة" (Sarda Trading & Industry), specializing in cleaning materials (`مواد التنظيف`) and cleaning tools (`أدوات التنظيف`). It is delivered as an installable **PWA** with offline support. Access is gated by two numeric **PINs** (a display PIN to view the catalog, an admin PIN to manage products).

### Framework
- **React 19** (via the React 19-compatible `@vitejs/plugin-react` 5.x and `react/jsx-runtime`).
- **TanStack Start** (`@tanstack/react-start` 1.168) — full-stack React framework providing **SSR + static prerendering** on top of **TanStack Router** (`@tanstack/react-router` 1.170).
- File-based routing under `src/routes/`, compiled to `src/routeTree.gen.ts` by the TanStack Start Vite plugin.

### Libraries
| Concern | Library |
|---|---|
| Data fetching / cache | `@tanstack/react-query` 5.101 |
| **Backend SDK (Blink)** | `@blinkdotnew/sdk` ^2.6.2 — DB + storage + auth client |
| **UI kit (Blink)** | `@blinkdotnew/ui` ^0.5.2 — Shadcn-style components, theming, toasts, AppShell |
| Animation | `framer-motion` ^12.40 |
| Icons | `lucide-react` ^1.17 |
| Toasts | `react-hot-toast` ^2.6 (declared) + `Toaster`/`toast` re-exported from `@blinkdotnew/ui` (actually used) |
| Forms | `react-hook-form` ^7.78 + `@hookform/resolvers` + `zod` ^4.4 (declared; **not yet used** in `src/`) |
| Styling utils | `clsx`, `tailwind-merge` (combined in `cn()`), `tailwindcss-animate` |
| Dates | `date-fns` ^4.4 (declared; not used in `src/`) |
| Misc declared-but-unused in app code | `@dnd-kit/core`, `@react-three/drei`, `@react-three/fiber`, `recharts`, `react-responsive` |
| Styling | Tailwind CSS 3.4 + PostCSS + Autoprefixer |

> **Note:** A large share of the dependency list is **scaffolding from the template** (3D/`three`, charts, drag-and-drop, responsive helpers) and is not referenced anywhere in `src/`. See §9 and §10.

### Build system
- **Vite 8** with the TanStack Start plugin.
- Build pipeline (`package.json` → `build`):
  1. `vite build` — produces SSR + **prerendered static client** into `.vite-out/` (`outDir: '.vite-out'`, `crawlLinks: true`, `failOnError: false`).
  2. `node scripts/finalize-static-build.mjs` — flattens `.vite-out/client/*` into a static `dist/` (drops the Nitro server) so the host serves `dist/index.html`. Tolerates a pre-injected read-only `_redirects`.
- **Linting** (`npm run lint`) chains: `tsc --noEmit` → ESLint (ts/tsx) → Stylelint → `check:css-vars` → `check:css-classes`. (The two `check:*` scripts are referenced in `package.json` but their files are **not present** under `scripts/` — only `finalize-static-build.mjs` exists.)
- **Custom Vite plugin:** `blink-tagger.plugin.mjs` — Blink Visual Editor tagger; **OFF by default**, enabled only with `BLINK_BUILD_TIME_TAGGER=on`.
- TypeScript ~6.0, `tsconfig.json` with `@/*` → `src/*` path alias (mirrored in `vite.config.ts`).

### Folder structure
```
surda-catalog/
├── package.json, tsconfig*.json, vite.config.ts, postcss.config.cjs, tailwind.config.cjs
├── blink-tagger.plugin.mjs        # Blink Visual Editor build plugin (opt-in)
├── README.md                      # Generic template readme (CSS-var checker)
├── INSTALL.md                     # ⚠️ Stale: describes a "Chrome Extension" install (does not match this app)
├── scripts/
│   └── finalize-static-build.mjs  # flatten .vite-out/client → dist/
├── public/                        # PWA assets: manifest.json, sw.js, icons/, _redirects, sitemap.xml, robots.txt, favicon.svg
└── src/
    ├── Shell.tsx                  # Blink AppShell wrapper (UNUSED by routes)
    ├── router.tsx                 # createRouter() / getRouter for TanStack Start
    ├── routeTree.gen.ts           # AUTO-GENERATED route tree (do not edit)
    ├── index.css                  # Tailwind layers + Blink UI theme + app palette (RTL, Tajawal font)
    ├── blink/
    │   └── client.ts              # createClient() — the single Blink SDK instance
    ├── routes/
    │   ├── __root.tsx             # HTML document, head/SEO, providers, SW registration
    │   ├── index.tsx              # "/" PIN gate (landing)
    │   ├── catalog.tsx            # "/catalog" product grid
    │   ├── product.$id.tsx        # "/product/:id" product detail
    │   ├── admin.tsx              # "/admin" product management
    │   └── settings.tsx           # "/settings" ⚠️ STUB ("Hello /settings!")
    ├── components/
    │   ├── ProductCard.tsx, AdminProductForm.tsx, AdminProductRow.tsx,
    │   ├── ImageViewer.tsx, PinPad.tsx,
    │   └── AppSidebarShell.tsx    # template SaaS sidebar (UNUSED)
    ├── hooks/
    │   ├── useProducts.ts, useIsClient.ts, useAdminGuard.ts (UNUSED)
    ├── layouts/
    │   └── shared-app-layout.tsx  # template SaaS layout (UNUSED)
    ├── lib/
    │   ├── storage.ts             # PIN + logo + lock state (local/sessionStorage)
    │   ├── offline-db.ts          # IndexedDB product cache
    │   ├── backup.ts              # JSON export/import of catalog (UNUSED by any route)
    │   └── utils.ts               # cn() helper
    ├── types/
    │   └── product.ts             # Product, ProductCategory, AppSettings
    └── assets/                    # hero.png, vite.svg, typescript.svg (template leftovers)
```

---

## 2. Routes

Routing is **file-based** (TanStack Router). The generated tree (`routeTree.gen.ts`) confirms five routes under the root.

| Path | File | Purpose |
|---|---|---|
| *(document root)* | `routes/__root.tsx` | Owns the `<html dir="rtl" lang="ar">` document for SSR. Defines global `<head>` (SEO meta, Open Graph, Twitter card, theme-color, apple-mobile tags, JSON-LD `WebSite`+`Organization`), links the stylesheet + PWA manifest + apple-touch-icon. Wraps the app in `QueryClientProvider` and `BlinkUIProvider` (theme `minimal`, light) + `<Toaster/>`. Inlines a `<script>` that registers `/sw.js`. **No app chrome** (full-bleed). |
| `/` | `routes/index.tsx` | **PIN gate / landing.** Shows branding and two buttons: "فتح الكتالوج" (display) and "لوحة المدير" (admin). On mount, if already unlocked (`isPinUnlocked()`), redirects to `/catalog`. Selecting a mode renders `<PinPad>` with the relevant correct PIN; success unlocks session state and navigates to `/catalog` (display) or `/admin` (admin). |
| `/catalog` | `routes/catalog.tsx` | **Main catalog.** Guards on `isPinUnlocked()` (redirects to `/` if locked). Renders header (logo from storage, admin shortcut if admin-unlocked, settings + logout buttons), a search box, category tabs (`all` / مواد التنظيف / أدوات التنظيف with live counts), and a responsive product grid of `<ProductCard>`. Loading skeletons; empty state with an "add products" CTA for admins. Data via `useProducts()`. |
| `/product/$id` | `routes/product.$id.tsx` | **Product detail.** Fetches a single product by id via React Query (`fetchProduct` → `blink.db...get`). Shows large image (opens `<ImageViewer>` with pinch/zoom), name, description, and spec cards (size, carton quantity, carton price in ₪, Arabic-formatted numbers). Handles loading + not-found states. **Not PIN-guarded** (relies on having no link in when locked). |
| `/admin` | `routes/admin.tsx` | **Admin product management.** Guards on `isPinUnlocked() && isAdminUnlocked()`. Lists ALL products (including hidden) via React Query (`fetchAllProducts`). Supports add/edit (`<AdminProductForm>` modal), delete, show/hide toggle, and manual reorder (up/down via two `update` calls swapping `sortOrder`). All writes are React Query mutations that invalidate `['admin-products']` and call `useProducts().refresh()`. |
| `/settings` | `routes/settings.tsx` | **⚠️ STUB.** Renders literally `<div>Hello "/settings"!</div>`. The catalog header links here, but the page is unimplemented. (PIN-change / logo-upload / backup features implied by `storage.ts` + `backup.ts` are **not wired to any UI**.) |

---

## 3. Components (reusable)

| Component | File | Role | Notes |
|---|---|---|---|
| `ProductCard` | `components/ProductCard.tsx` | Catalog grid card → links to `/product/$id`. Image (lazy), category badge, name, description, size pill, carton price. | Pure/presentational. |
| `AdminProductForm` | `components/AdminProductForm.tsx` | Add/edit modal. Category toggle, name/description/size/qty/price fields, image upload with preview. **Performs `blink.storage.upload` + `blink.db.create/update`** directly. | Contains Blink data + storage calls (not lifted to a hook). |
| `AdminProductRow` | `components/AdminProductRow.tsx` | Admin list row: thumbnail, name, category+price, hidden badge, and action buttons (hide/edit/delete + reorder arrows). | Presentational; calls back to parent handlers. Delete uses native `confirm()`. |
| `ImageViewer` | `components/ImageViewer.tsx` | Full-screen image viewer: Escape-to-close, zoom buttons, double-tap zoom, two-finger pinch zoom. | Pure; no backend. |
| `PinPad` | `components/PinPad.tsx` | 4-digit numeric keypad with shake-on-error animation. Calls `onSuccess` when entered PIN equals `correctPin`. | Pure; PIN comparison is **client-side plaintext**. |
| `Shell` | `Shell.tsx` | Blink `AppShell` mobile layout wrapper. | **UNUSED** by any route (template scaffolding). |
| `AppSidebarShell` | `components/AppSidebarShell.tsx` | Collapsible SaaS sidebar built on `@blinkdotnew/ui` primitives. | **UNUSED** (template scaffolding; hardcoded "App"/Dashboard nav). |

---

## 4. Hooks (custom)

| Hook | File | Purpose | Used? |
|---|---|---|---|
| `useProducts` | `hooks/useProducts.ts` | **Central catalog data hook.** Fetches products (`blink.db...list({orderBy:{sortOrder:'asc'}})`), caches to IndexedDB for offline, falls back to cached products on failure. Exposes `products` (filtered: visible-only, category + search), `allProducts`, `isLoading`, `error`, `searchQuery`/`setSearchQuery`, `selectedCategory`/`setSelectedCategory`, per-category `counts`, and `refresh()` (invalidates the `['products']` query). | ✅ catalog + admin (for `refresh`) |
| `useIsClient` | `hooks/useIsClient.ts` | Returns `true` only after mount — used to defer client-only logic (storage reads, redirects) so SSR/hydration doesn't mismatch. | ✅ index, catalog, admin |
| `useAdminGuard` | `hooks/useAdminGuard.ts` | Returns `checkAdmin()` which reads `sessionStorage['sarda_admin_unlocked']`, toasts + redirects to `/` if not admin. | ⚠️ **UNUSED** — admin guarding is instead done inline in `admin.tsx` via `isAdminUnlocked()`. |

> Observation: `useProducts` has a `useEffect` with an empty dependency array (`[]`) that seeds cached data into the query — works, but ESLint exhaustive-deps would flag it. Reorder in `admin.tsx` fires two independent mutations per move (not transactional).

---

## 5. Data layer

### How products are loaded — exact flow

1. **`blink/client.ts`** creates a single SDK client:
   ```ts
   export const blink = createClient({
     projectId: import.meta.env.VITE_BLINK_PROJECT_ID || 'sarda-catalog-pwa-k9uwa31b',
     publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY || 'blnk_pk_…',
     authRequired: false,
     auth: { mode: 'managed' },
   });
   ```
   The default `projectId` and `publishableKey` are **hardcoded fallbacks** in source.

2. **Catalog list** (`hooks/useProducts.ts` → `fetchProducts`):
   - `await blink.db.table<Product>('products').list({ orderBy: { sortOrder: 'asc' } })`
   - On success → `saveProductsToCache(products)` (IndexedDB, fire-and-forget) → return.
   - On throw (offline) → `getCachedProducts()` from IndexedDB.
   - React Query key `['products']`, `staleTime: 30s`. A mount effect also pre-seeds from cache if the query is empty.
   - Client-side filtering: `isHidden === 0`, category match, and case-insensitive search across name/description/size. Counts computed from visible products.

3. **Single product** (`routes/product.$id.tsx` → `fetchProduct`):
   - `await blink.db.table<Product>('products').get(id)` inside try/catch (returns `null` on failure). Query key `['product', id]`.

4. **Admin full list** (`routes/admin.tsx` → `fetchAllProducts`):
   - `await blink.db.table<Product>('products').list({ orderBy: { sortOrder: 'asc' } })` — includes hidden. Query key `['admin-products']`, enabled only when unlocked + client.

### Every Blink SDK call (complete inventory)

**`blink.db`** — all against the `products` table:
| Location | Call | Operation |
|---|---|---|
| `hooks/useProducts.ts:11` | `blink.db.table<Product>('products').list({ orderBy: { sortOrder: 'asc' } })` | Read all (catalog) |
| `routes/admin.tsx:16` | `blink.db.table<Product>('products').list({ orderBy: { sortOrder: 'asc' } })` | Read all (admin) |
| `routes/product.$id.tsx:12` | `blink.db.table<Product>('products').get(id)` | Read one |
| `components/AdminProductForm.tsx:78` | `blink.db.table<Product>('products').create(data)` | Create |
| `components/AdminProductForm.tsx:74` | `blink.db.table<Product>('products').update(editingProduct.id, data)` | Update (edit) |
| `routes/admin.tsx:55` | `blink.db.table<Product>('products').update(id, { isHidden })` | Update (hide toggle) |
| `routes/admin.tsx:65` | `blink.db.table<Product>('products').update(id, { sortOrder })` | Update (reorder) |
| `routes/admin.tsx:44` | `blink.db.table<Product>('products').delete(id)` | Delete |

**`blink.storage`**:
| Location | Call | Operation |
|---|---|---|
| `components/AdminProductForm.tsx:50` | `blink.storage.upload(file, \`products/${Date.now()}.${ext}\`)` → `{ publicUrl }` | Upload product image, return public URL stored as `imageUrl` |

**`blink.auth`**:
- **None.** There are no `blink.auth.*` calls anywhere in `src/`. The client is configured `authRequired: false`, `auth: { mode: 'managed' }`, but the auth surface is never invoked. Authentication in this app is **entirely PIN-based and local** (see §6).

**`@blinkdotnew/ui` (UI library, separate from the data SDK):**
- `BlinkUIProvider`, `Toaster`, `toast` (root + form + admin + unused admin-guard hook)
- `AppShell`, `AppShellSidebar`, `AppShellMain`, `MobileSidebarTrigger` (in unused `Shell.tsx`)
- `Avatar`, `AvatarFallback`, `Button`, `Tooltip*` (in unused `AppSidebarShell.tsx`)
- `@blinkdotnew/ui/styles` imported in `index.css` (theme variables — required for those components to render).

---

## 6. Authentication

**There is no real authentication / identity system.** Access control is a purely client-side PIN gate:

- **Two PINs** stored in `localStorage` (`lib/storage.ts`):
  - `sarda_display_pin` (default `'1234'`)
  - `sarda_admin_pin` (default `'4321'`)
- **Lock state** stored in `sessionStorage`:
  - `sarda_pin_unlocked` = `'true'` after any successful PIN
  - `sarda_admin_unlocked` = `'true'` after a successful admin PIN
- **Flow:** `index.tsx` renders `<PinPad>` with `correctPin = getDisplayPin()` or `getAdminPin()`. `PinPad` compares the typed 4 digits to `correctPin` **in plaintext, in the browser**. Success → `unlockPin()` (+ `unlockAdmin()` for admin) → navigate.
- **Guards:** `catalog.tsx` redirects to `/` unless `isPinUnlocked()`. `admin.tsx` redirects unless `isPinUnlocked() && isAdminUnlocked()`. `/product/$id` is **not** guarded. Logout (`lockPin()`) clears both session keys.
- **Defaults are hardcoded** and PINs are only changed if something writes to `setDisplayPin`/`setAdminPin` — but **no UI calls those setters** (the settings page is a stub). So in practice the PINs are the defaults `1234` / `4321`.

> Security implication: this gate is cosmetic. PINs live in `localStorage`, comparison is client-side, and the Blink DB is reachable with the embedded publishable key regardless of PIN. It deters casual viewing on a shared device, not a determined user. **This is relevant to the migration: there is no server-side auth to preserve.**

---

## 7. Images

### Upload
- Only place images are uploaded: **`AdminProductForm.tsx`** (`uploadImage`):
  ```ts
  const ext = file.name.split('.').pop() || 'jpg';
  const { publicUrl } = await blink.storage.upload(file, `products/${Date.now()}.${ext}`);
  ```
  The file is chosen via a hidden `<input type="file" accept="image/*">`; a local preview is shown with `URL.createObjectURL(file)` before upload. Upload happens on form submit; the returned `publicUrl` is saved into the product's `imageUrl` field via `blink.db ... create/update`.

### Storage
- Images are stored in **Blink Storage** under the path prefix `products/<timestamp>.<ext>`. Blink returns a **public URL**; that URL string is the only thing persisted in the database (`Product.imageUrl`). There is no separate image table or metadata.
- The **company logo** is handled differently: `getCompanyLogo()/setCompanyLogo()` read/write `localStorage['sarda_company_logo']` as a URL/string. No upload path is wired for it (settings stub), so it is effectively empty and the catalog falls back to an inline SVG logo.

### Retrieval
- Images are read straight from `product.imageUrl` as `<img src={...}>` in `ProductCard`, `AdminProductRow`, and `product.$id` (and the full-screen `ImageViewer`). No transformation, signing, or resizing — the public Blink URL is used as-is. `ProductCard` uses `loading="lazy"`.
- `lib/backup.ts` (unused by UI) can `fetch()` each `imageUrl`, convert to base64, and embed images in a JSON backup — i.e. a portability/export path that does not depend on Blink to read back.

---

## 8. Database

### Tables
Exactly **one** table is used: **`products`** (referenced as `blink.db.table('products')`). No other tables. (`AppSettings` exists as a TS type but settings are persisted to `localStorage`, not the DB.)

### Fields (from `types/product.ts` + write paths)
| Field | Type | Notes / source of truth |
|---|---|---|
| `id` | `string` | Primary key. `get(id)`/`delete(id)` use it; assumed generated by Blink on `create`. |
| `name` | `string` | Required (validated in form). |
| `description` | `string` | Optional. |
| `size` | `string` | Only meaningful for `مواد التنظيف`; forced to `''` for `أدوات التنظيف`. |
| `cartonQuantity` | `number` | `parseInt`, default 0. |
| `cartonPrice` | `number` | `parseFloat`, default 0; displayed as ₪ with Arabic locale. |
| `imageUrl` | `string` | Public URL from Blink Storage; `''` if none. |
| `category` | `'مواد التنظيف' \| 'أدوات التنظيف'` | Enum (`ProductCategory`). |
| `isHidden` | `number` | 0 = visible, 1 = hidden. Stored/compared as number (`Number(p.isHidden) === 0`). Set to 0 on create; toggled in admin. |
| `sortOrder` | `number` | Manual ordering; set to `productCount` on create; swapped on reorder. |
| `createdAt` | `string` | ISO timestamp (type declares it; likely set by Blink — create path does not set it explicitly). |
| `updatedAt` | `string` | ISO timestamp; set explicitly to `new Date().toISOString()` on **update** only. |

`AppSettings` type (NOT a DB table): `displayPin`, `adminPin`, `companyLogo` — all live in `localStorage`.

### Relationships
- **None.** Single flat table, no foreign keys, no joins. "Category" is an inline enum string, not a related table. Images are referenced by URL string, not a relation. Ordering and visibility are plain columns on `products`.

---

## 9. Dependency map

```
App entry (TanStack Start)
└── router.tsx → routeTree.gen.ts
    └── routes/__root.tsx
        ├── @tanstack/react-query .......... QueryClientProvider (app-wide cache)
        ├── @blinkdotnew/ui ................ BlinkUIProvider, Toaster   [BLINK UI]
        ├── index.css → @blinkdotnew/ui/styles + Tailwind            [BLINK UI]
        ├── inline <script> ................ registers public/sw.js (PWA)
        │
        ├── routes/index.tsx (PIN gate)
        │   ├── components/PinPad ........... framer-motion, lib/utils(cn)
        │   ├── hooks/useIsClient
        │   └── lib/storage ................. localStorage/sessionStorage (PINs, locks)
        │
        ├── routes/catalog.tsx
        │   ├── hooks/useProducts ──────────┐
        │   │     ├── @tanstack/react-query │
        │   │     ├── blink.db.list ........ [BLINK DB]
        │   │     └── lib/offline-db ....... IndexedDB cache
        │   ├── components/ProductCard ...... @tanstack/react-router Link, framer-motion
        │   ├── hooks/useIsClient
        │   └── lib/storage (logo, locks)
        │
        ├── routes/product.$id.tsx
        │   ├── @tanstack/react-query
        │   ├── blink.db.get ............... [BLINK DB]
        │   └── components/ImageViewer ...... framer-motion
        │
        ├── routes/admin.tsx
        │   ├── @tanstack/react-query (query + 3 mutations)
        │   ├── blink.db.list/update/delete [BLINK DB]
        │   ├── @blinkdotnew/ui toast ....... [BLINK UI]
        │   ├── hooks/useProducts (refresh), hooks/useIsClient, lib/storage
        │   ├── components/AdminProductRow
        │   └── components/AdminProductForm
        │         ├── blink.storage.upload .. [BLINK STORAGE]
        │         ├── blink.db.create/update  [BLINK DB]
        │         └── @blinkdotnew/ui toast . [BLINK UI]
        │
        └── routes/settings.tsx ............. STUB (no deps)

Shared infra:
  blink/client.ts → @blinkdotnew/sdk createClient  [BLINK CORE]
  lib/storage.ts, lib/offline-db.ts, lib/backup.ts(unused), lib/utils.ts

UNUSED / template scaffolding (no inbound imports from routes):
  Shell.tsx, components/AppSidebarShell.tsx, layouts/shared-app-layout.tsx,
  hooks/useAdminGuard.ts, lib/backup.ts, src/assets/*,
  deps: @react-three/*, recharts, @dnd-kit/core, react-responsive,
        date-fns, react-hook-form, @hookform/resolvers, zod, react-hot-toast, glob
```

---

## 10. Refactor report — Blink dependency classification

There are **three distinct Blink surfaces**: the **data SDK** (`@blinkdotnew/sdk`: db + storage + auth), the **UI kit** (`@blinkdotnew/ui`), and the **Visual Editor tagger** (`blink-tagger.plugin.mjs`).

| # | Blink dependency | Where | Classification | Rationale |
|---|---|---|---|---|
| 1 | `blink.db` (CRUD on `products`) | useProducts, admin, product.$id, AdminProductForm | **Required (functionality), Replaceable (implementation)** | The catalog cannot work without a data store. The *behavior* must be preserved, but the *provider* can be swapped (Supabase, REST API, SQLite/PostgREST, etc.). Surface is tiny: `list({orderBy})`, `get(id)`, `create`, `update`, `delete`. |
| 2 | `blink.storage.upload` (product images) | AdminProductForm | **Required (functionality), Replaceable (implementation)** | Image upload must stay. Single call returning a public URL → trivially replaceable by Supabase Storage / S3 / any upload endpoint returning a URL. |
| 3 | `blink.auth` | — | **Can be removed** | Never used. The client sets `authRequired: false`; no auth calls exist. Dropping auth config changes nothing functionally. |
| 4 | `@blinkdotnew/sdk` `createClient` + `blink/client.ts` | client.ts | **Replaceable** | Only exists to provide #1–#3. Replace with a thin data-access module wrapping the new backend. |
| 5 | `@blinkdotnew/ui` — `toast` / `Toaster` | root, admin, form, (unused hook) | **Replaceable** | Toast notifications are used in real paths. `react-hot-toast` is already a dependency and offers an equivalent `toast`/`Toaster`; swap is mechanical. |
| 6 | `@blinkdotnew/ui` — `BlinkUIProvider` + `@blinkdotnew/ui/styles` | root, index.css | **Replaceable (with care)** | Provides theme CSS variables (`--primary`, `--background`, etc.) that the app's Tailwind classes depend on. Removing requires porting the consumed CSS variables into `index.css` so the design tokens survive. |
| 7 | `@blinkdotnew/ui` — `AppShell*`, `Avatar`, `Button`, `Tooltip*` | Shell.tsx, AppSidebarShell.tsx | **Can be removed** | Only used by **unused** template files. Delete the files and these imports vanish. |
| 8 | `blink-tagger.plugin.mjs` + `BLINK_BUILD_TIME_TAGGER` | vite.config.ts | **Can be removed** | Off by default; Visual-Editor-only. Removing the plugin and its conditional has no runtime effect. |
| 9 | Hardcoded `projectId` / `publishableKey` fallbacks | client.ts | **Can be removed** (with #4) | Blink-specific credentials; replaced by the new backend's config/env. |
| 10 | Catalog metadata: `data-blnk-id` tagging, Blink hosting assumptions in build (`dist/` flatten, pre-injected `_redirects`) | finalize-static-build.mjs, vite.config comments | **Replaceable** | Build can target any static host; the flatten step is generic, only the *comments/assumptions* reference Blink. Keep the flatten; drop Blink-specific notes. |

**Also worth flagging (not Blink, but cleanup opportunities surfaced by the audit):**
- Unused deps that can be dropped to shrink the tree: `@react-three/drei`, `@react-three/fiber`, `recharts`, `@dnd-kit/core`, `react-responsive`, `date-fns`, `zod`, `react-hook-form`, `@hookform/resolvers`, `glob` (none imported in `src/`). Verify before removing.
- `scripts/check-css-variables.js` and `scripts/check-css-classes.js` are referenced by `npm run lint` but **do not exist** → `lint` currently fails. (Out of scope for the Blink migration but should be tracked.)
- `useAdminGuard.ts`, `lib/backup.ts`, `Shell.tsx`, `AppSidebarShell.tsx`, `layouts/shared-app-layout.tsx`, `src/assets/*` are dead code.
- `INSTALL.md` describes a Chrome extension and does not match this PWA.

---

## 11. Migration plan — removing Blink completely (no code in this phase)

**Objective:** Remove `@blinkdotnew/sdk`, `@blinkdotnew/ui`, and the Blink build tagger while preserving 100% of current functionality (catalog browse, product detail, admin CRUD, image upload, offline cache, PWA, PIN gate, RTL/Arabic SEO).

### Guiding principles
1. **Isolate before replacing.** All Blink data/storage access should flow through one module so the backend swap is a single, well-tested change.
2. **Preserve the contract, not the provider.** Keep the exact `Product` shape and the operations (`list orderBy sortOrder`, `get`, `create`, `update`, `delete`, `upload → publicUrl`).
3. **Migrate UI and data independently.** They are separable; do the lower-risk UI/toast/tagger removals first, then the data backend.
4. **Keep the PIN gate as-is** initially — it is local and Blink-independent. (Optionally harden later; not required to remove Blink.)

### Recommended target backend
**Supabase** is the lowest-friction replacement: it provides a Postgres table (`products`), Storage with public URLs (matching the current `publicUrl` model), and a JS client with `select().order()`, `insert`, `update`, `delete` that maps almost 1:1 onto the current calls. (A Supabase MCP server is available in this environment.) Any REST/SQLite-backed API would also satisfy the contract — the abstraction in Step 2 keeps this decision reversible.

### Phased path (safest order)

**Phase A — De-risk: remove dead Blink surfaces (no behavior change)**
- A1. Delete unused template files that import `@blinkdotnew/ui`: `Shell.tsx`, `components/AppSidebarShell.tsx`, `layouts/shared-app-layout.tsx`. (Removes dependency #7.)
- A2. Remove the Visual Editor tagger: drop `blink-tagger.plugin.mjs` usage from `vite.config.ts` and the `BLINK_BUILD_TIME_TAGGER` branch. (Dependency #8.)
- A3. Generalize build comments (no functional change). Keep `finalize-static-build.mjs` (it's host-agnostic).
- *Checkpoint:* app builds and behaves identically; only dead Blink code is gone.

**Phase B — Replace the Blink UI provider + toasts**
- B1. Port the CSS variables currently injected by `@blinkdotnew/ui/styles` (the design tokens the Tailwind config consumes — `--primary`, `--accent`, `--background`, `--border`, etc.) directly into `src/index.css`, then remove the `@import '@blinkdotnew/ui/styles'`. Validate the palette/RTL visually.
- B2. Replace `BlinkUIProvider` with the app's own root wrapper (just light theme + the ported tokens).
- B3. Replace `Toaster`/`toast` from `@blinkdotnew/ui` with `react-hot-toast` (already a dependency) — mechanical import swap in `__root.tsx`, `admin.tsx`, `AdminProductForm.tsx` (and remove the unused `useAdminGuard.ts` or migrate its toast too). (Dependencies #5, #6.)
- *Checkpoint:* `@blinkdotnew/ui` is no longer imported anywhere; remove it from `package.json`.

**Phase C — Introduce a data-access abstraction (no provider yet)**
- C1. Define a small repository interface mirroring today's usage, e.g. `productsRepo.list()`, `.get(id)`, `.create(data)`, `.update(id, data)`, `.delete(id)` and `storage.uploadProductImage(file) → url`.
- C2. Implement it **first as a Blink-backed adapter** that wraps the existing `blink.*` calls — change call sites in `useProducts`, `product.$id`, `admin`, `AdminProductForm` to use the repo instead of `blink` directly. Behavior is unchanged; this purely centralizes the Blink dependency into one adapter file.
- *Checkpoint:* `blink.db`/`blink.storage` appear in exactly one file. All routes/components are Blink-agnostic.

**Phase D — Stand up the replacement backend and migrate data**
- D1. Create the `products` table on the new backend with the exact columns from §8 (including `isHidden` as integer, `sortOrder` as integer, `createdAt`/`updatedAt` defaults). Create a public Storage bucket for `products/` images.
- D2. **Data migration:** export current products from Blink (the `list` call, or the existing `lib/backup.ts` JSON export which already base64-embeds images) and import rows + re-upload images to the new bucket, rewriting each `imageUrl` to the new public URL. `lib/backup.ts` is a ready-made portability tool for this.
- D3. Implement a **new adapter** behind the same repository interface from Phase C (e.g. Supabase client: `from('products').select().order('sortOrder')`, `insert`, `update`, `delete`; storage `upload` → `getPublicUrl`).

**Phase E — Cut over and remove Blink core**
- E1. Switch the repository to the new adapter (single import change). Keep the IndexedDB offline cache (`offline-db.ts`) untouched — it already wraps whatever the repo returns, so offline support is preserved automatically.
- E2. Run through all flows: catalog list/search/category counts, product detail, admin add/edit/delete/hide/reorder, image upload, offline reload, PWA install. Confirm Arabic number formatting and RTL intact.
- E3. Delete `src/blink/client.ts`, remove `@blinkdotnew/sdk` from `package.json`, and add the new backend's config via `VITE_*` env vars (replacing the hardcoded `projectId`/`publishableKey`).
- *Checkpoint:* zero references to `@blinkdotnew/*`; `grep -r blink src/` returns nothing but historical comments.

**Phase F — Cleanup (optional, post-migration)**
- Drop genuinely unused dependencies (§10) after verification.
- Restore or remove the missing `check:css-*` lint scripts so `npm run lint` passes.
- Implement or remove the `/settings` stub (and wire `storage.ts` PIN/logo setters + `backup.ts` if settings UI is desired).
- Optionally harden the PIN gate (server-side check) — independent of the Blink removal.

### Risk register
| Risk | Mitigation |
|---|---|
| Lost design tokens when dropping `@blinkdotnew/ui/styles` | Port variables into `index.css` first (Phase B1) and visually diff before removing the import. |
| Image URLs break after migration | Re-upload images and rewrite `imageUrl` in the same migration transaction (Phase D2); keep Blink read-only until cutover verified. |
| Reorder uses two non-atomic `update` calls | Preserve current behavior in the adapter; optionally make it a single batched update on the new backend. |
| Offline cache returns stale schema | `Product` shape is unchanged across providers, so IndexedDB cache stays compatible; bump `DB_VERSION` only if columns change. |
| Hardcoded credentials currently let the build work without env | Provide `.env` with new backend keys before removing fallbacks (Phase E3). |
| `prerender`/SSR expects no client-only globals at build | Data fetching is already client-side via React Query; keep repo calls out of `head()`/render-time SSR to avoid build-time backend calls. |

**End state:** A Blink-free PWA with identical UX, a single swappable data-access layer, ported design tokens, `react-hot-toast` notifications, and a clean dependency list — with the PIN gate, offline cache, and Arabic/RTL SEO fully preserved.

---

*End of audit. No source files were modified; this document is the only artifact produced in Phase 1.*
