# `server/database/` — Schema, migrations & data access (future)

> **Status: scaffolding only.** No schema or DB code exists yet. Blink still owns the data.

## Future responsibility

Own the persistent store that replaces `blink.db`. This includes the table schema,
migrations, and the data-access functions the `server/api/` layer calls.

## Table to recreate: `products`

The app uses **exactly one table** (see `PROJECT_AUDIT.md` §8). The replacement schema
must preserve every field and its semantics:

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | Generated on create. |
| `name` | string | Required. |
| `description` | string | Optional. |
| `size` | string | Empty for category `أدوات التنظيف`. |
| `cartonQuantity` | integer | Default 0. |
| `cartonPrice` | number | Default 0; displayed in ₪. |
| `imageUrl` | string | Public URL from the storage layer; `''` if none. |
| `category` | enum string | `'مواد التنظيف'` \| `'أدوات التنظيف'`. |
| `isHidden` | integer | 0 = visible, 1 = hidden. **Keep as number**, not boolean. |
| `sortOrder` | integer | Manual ordering. |
| `createdAt` | string (ISO) | Set on create. |
| `updatedAt` | string (ISO) | Set on update. |

**No relationships** — single flat table. Category is an inline enum, not a foreign key.

## Index/ordering notes

- Default read order is `sortOrder ASC` (every list call relies on this).
- An index on `sortOrder` (and optionally `category`) mirrors the current IndexedDB
  offline cache (`src/lib/offline-db.ts`), which indexes `category` and `sortOrder`.

## Migration safety

- Keep `isHidden` and `sortOrder` numeric so the existing client comparisons
  (`Number(p.isHidden) === 0`) keep working unchanged.
- The `Product` TypeScript contract in `src/types/product.ts` is the source of truth;
  the schema must serialize to it 1:1.

## Candidate backend

`PROJECT_AUDIT.md` §11 recommends **Supabase (Postgres)** as the lowest-friction target
because its `select().order()` / `insert` / `update` / `delete` map almost 1:1 onto the
current Blink calls. Any SQL/REST store satisfying the contract is acceptable.
