# Database

The backend uses a single **SQLite** database file (`catalog.db`) via Node's built-in
`node:sqlite`. It is created automatically on first boot, with the schema applied
idempotently (`server/src/database/`).

- File path: `CATALOG_DB_PATH` (default `./catalog.db`, relative to the server's CWD).
- Journal mode: **WAL**; `foreign_keys = ON`.
- The file is **git-ignored** (it is data, not code).

## Table: `products`

One flat table — no relationships. Fields mirror the original Blink `Product` shape exactly.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PRIMARY KEY | UUID, server-generated |
| `name` | TEXT NOT NULL | required |
| `description` | TEXT NOT NULL DEFAULT '' | |
| `size` | TEXT NOT NULL DEFAULT '' | empty for `أدوات التنظيف` |
| `cartonQuantity` | INTEGER NOT NULL DEFAULT 0 | |
| `cartonPrice` | REAL NOT NULL DEFAULT 0 | may be decimal |
| `imageUrl` | TEXT NOT NULL DEFAULT '' | relative `/uploads/products/<file>` or '' |
| `category` | TEXT NOT NULL | `مواد التنظيف` \| `أدوات التنظيف` |
| `isHidden` | INTEGER NOT NULL DEFAULT 0 | 0 = visible, 1 = hidden |
| `sortOrder` | INTEGER NOT NULL DEFAULT 0 | ascending display order |
| `createdAt` | TEXT NOT NULL | ISO timestamp |
| `updatedAt` | TEXT NOT NULL | ISO timestamp |

### Indexes
- `idx_products_sortOrder` on `sortOrder` (default read order)
- `idx_products_category` on `category`

## Access patterns (all via `ProductsService`)
- `list()` — `SELECT * … ORDER BY sortOrder ASC`
- `get(id)` — by primary key
- `create(input)` / `update(id, patch)` — via an `INSERT … ON CONFLICT(id) DO UPDATE` upsert
- `delete(id)`
- `reorder(items)` — multiple `UPDATE`s in a single transaction (all-or-nothing)

Prepared statements are cached on the service instance. Multi-statement writes run inside a
`BEGIN/COMMIT` transaction (rolled back on error).

## Schema changes
Edit `server/src/database/schema.ts`. There is no migration framework; for a column change,
add an idempotent `ALTER TABLE` guarded by a check, or recreate from a backup (see
`BACKUP.md` / `RESTORE.md`). **Coordinate any schema change with the `Product` type in
`src/types/product.ts`.**
