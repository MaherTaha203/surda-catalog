# `src/models/` — Shared domain models (future)

> **Status: scaffolding only.** Empty in Phase 2. The live types still live in `src/types/`.

## Future responsibility

Become the single source of truth for the app's **domain types and validation schemas**,
shared across `src/services/`, `src/api/`, and (conceptually) `server/`. This lets the
frontend and the future backend agree on the same `Product` contract.

## What will live here

- The `Product` interface and `ProductCategory` enum (currently in
  `src/types/product.ts` — see `PROJECT_AUDIT.md` §8).
- The `AppSettings` shape (`displayPin`, `adminPin`, `companyLogo`).
- Optional **runtime validation schemas** (`zod` is already a dependency) to validate
  API responses and form input against the model.

## Current model (to be mirrored/centralized — do NOT move it in Phase 2)

```ts
type ProductCategory = 'مواد التنظيف' | 'أدوات التنظيف';

interface Product {
  id: string;
  name: string;
  description: string;
  size: string;
  cartonQuantity: number;
  cartonPrice: number;
  imageUrl: string;
  category: ProductCategory;
  isHidden: number;     // 0 = visible, 1 = hidden
  sortOrder: number;
  createdAt: string;    // ISO
  updatedAt: string;    // ISO
}
```

## Rules

- **Do not move** `src/types/product.ts` yet — Phase 2 is preparation only. When the
  model is centralized here later, `src/types/` can re-export from `src/models/` to
  avoid breaking existing imports.
- Keep `isHidden`/`sortOrder` numeric to match all existing client logic.
