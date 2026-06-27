# Sarda Catalog — Backend foundation (Fastify + SQLite)

> **Phase 3 status:** foundation only. The server boots, auto-creates the SQLite
> database + `products` table, and exposes a single `GET /health` endpoint.
> **Blink is untouched and the frontend is NOT connected.**

## Stack
- **Fastify 5** — HTTP server.
- **SQLite via `node:sqlite`** — Node 22's built-in driver (no native build step).
- **TypeScript**, run directly with **tsx** (no compile step needed to start).

## Run

From the repository root:

```bash
npm run server
```

This installs the server's dependencies (first run) and starts it. Equivalently,
from inside `server/`:

```bash
npm install
npm start      # or: npm run dev   (watch mode)
```

The server listens on **http://0.0.0.0:4000** by default.

### Verify
```bash
curl http://localhost:4000/health
# {"status":"ok"}
```

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | `{ "status": "ok" }` |
| `GET` | `/products` | All products, `sortOrder` asc (incl. hidden). |
| `GET` | `/products/:id` | One product, or 404. |
| `POST` | `/products` | Create (server generates id/timestamps) → 201. |
| `PUT` | `/products/:id` | Update fields → 200 / 404. |
| `DELETE` | `/products/:id` | Delete → 204 / 404. |
| `PATCH` | `/products/:id/visibility` | Body `{ isHidden }` or `{ hidden }` → 200 / 404. |
| `PATCH` | `/products/:id/order` | Body `{ sortOrder }` → 200 / 404. |
| `POST` | `/upload` | multipart `file` → 201 `{ url, filename, bytes }`. `?oldImageUrl=` deletes the replaced image. |
| `GET` | `/uploads/products/:file` | Static image serving. |

All product routes go through `ProductsService` and image/file logic through
`StorageService` — no SQL lives in route handlers.

### Image upload
`POST /upload` (multipart, field `file`) validates **mime type**, **extension**, and
**size** (`UPLOAD_MAX_BYTES`, default 5 MB), stores the image under
`server/uploads/products/` with a unique UUID filename, and returns its local URL
`/uploads/products/<file>`. Pass `?oldImageUrl=/uploads/products/<old>` to delete the
previous image when replacing. Deleting a product also deletes its image file.

## Automatic database initialization
On boot, `src/plugins/database.ts` calls `initDatabase()` which:
1. Creates **`catalog.db`** in the server's working directory if it does not exist.
2. Creates the **`products`** table (and indexes) if missing — idempotent.

The database file is **git-ignored** (it is data, regenerated on first run).
Override its location with `CATALOG_DB_PATH`.

### `products` table
Uses **exactly** the fields Blink uses today (see `PROJECT_AUDIT.md` §8 and
`src/types/product.ts`) — nothing invented:

`id, name, description, size, cartonQuantity, cartonPrice, imageUrl, category,
isHidden, sortOrder, createdAt, updatedAt`.

## Data migration (Blink → SQLite + local images)

```bash
npm run migrate
```

Reads every product from Blink, upserts them into SQLite (preserving `id` and all
field values), downloads each product image into `server/uploads/products/`, and
rewrites `imageUrl` to the local path `/uploads/products/<file>`. Blink is only
**read**, never modified.

It is **idempotent** — products upsert by primary key (no duplicates) and images are
skipped when already downloaded. It prints a summary:

```
Products migrated: 44
Images downloaded: 29
Skipped: 0
```

**Offline / backup source:** set `MIGRATE_SOURCE_FILE=/path/to/products.json` to
migrate from a JSON array (e.g. a `src/lib/backup.ts` export) instead of calling
Blink — useful when Blink's host is blocked by network egress rules.

> Live Blink reads require the host `core.blink.new` (and the image host) to be in
> the environment's network egress allowlist; otherwise use `MIGRATE_SOURCE_FILE`.

## Environment variables
| Var | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | Listen port. |
| `HOST` | `0.0.0.0` | Listen host. |
| `CATALOG_DB_PATH` | `./catalog.db` | SQLite file path. |
| `LOG_LEVEL` | `info` | Fastify log level. |
| `UPLOADS_DIR` | `./uploads/products` | Where migration stores downloaded images. |
| `UPLOADS_PUBLIC_PREFIX` | `/uploads/products` | Path prefix written into `imageUrl`. |
| `MIGRATE_SOURCE_FILE` | _(unset)_ | Migrate from a JSON file instead of Blink. |
| `VITE_BLINK_PROJECT_ID` / `VITE_BLINK_PUBLISHABLE_KEY` | frontend defaults | Blink read credentials. |

## Layout
```
server/
├── package.json, tsconfig.json, .gitignore
└── src/
    ├── index.ts              # entry — starts listening
    ├── app.ts                # Fastify factory (registers plugins + routes)
    ├── routes/
    │   └── health.ts         # GET /health -> { status: "ok" }
    ├── plugins/
    │   └── database.ts       # decorates fastify.db; auto-inits catalog.db
    ├── database/
    │   ├── index.ts          # open/create DB + run schema
    │   └── schema.ts         # products table DDL (exact Blink fields)
    └── services/
        └── products.ts       # data-access foundation (NOT wired to routes yet)
```

> Note: the top-level `server/{api,database,storage,sync,config}/README.md` files
> from Phase 2 are forward-looking design docs. The runnable code lives here under
> `server/src/`.
