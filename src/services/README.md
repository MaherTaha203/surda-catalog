# `src/services/` — Data-access abstraction layer (future)

> **Status: scaffolding only.** Empty in Phase 2. Routes/components still call Blink directly.

## Future responsibility

Host the **repository abstraction** described in `PROJECT_AUDIT.md` §11 (Phase C): a
single, backend-agnostic interface that all routes and components use **instead of**
importing `blink` directly. This is the seam that makes swapping Blink → new backend a
one-line change.

## Planned interface (preserves today's exact behavior)

```
productsService
  .list()                  -> Product[]   (ordered by sortOrder asc)
  .get(id)                 -> Product | null
  .create(data)            -> Product
  .update(id, data)        -> Product
  .delete(id)              -> void

storageService
  .uploadProductImage(file) -> { publicUrl }
```

## Migration role

1. **First**, a Blink-backed adapter implements this interface by wrapping the existing
   `blink.db` / `blink.storage` calls. Call sites in `useProducts`, `product.$id`,
   `admin`, and `AdminProductForm` switch to the service — **no behavior change**.
2. **Later**, a second adapter targets the new backend (via `src/api/`). Cutover is
   swapping which adapter the service exports.

After step 1, `blink.*` should appear in **exactly one** adapter file, not scattered
across routes/components.

## Rules

- Return types must match `src/types/product.ts` exactly.
- Keep the offline-cache behavior (`src/lib/offline-db.ts`) intact — the service wraps
  whatever the backend returns, so IndexedDB caching keeps working unchanged.
- Do **not** wire this up in Phase 2; this folder is prepared, not activated.
