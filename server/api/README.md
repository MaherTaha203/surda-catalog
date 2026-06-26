# `server/api/` — Backend HTTP API (future)

> **Status: scaffolding only.** No endpoints exist yet. Blink is still live.

## Future responsibility

Expose the HTTP endpoints that the frontend (`src/api/` + `src/services/`) will call
**instead of** talking to `blink.db` / `blink.storage` directly. This becomes the
single network boundary between the React app and the new backend.

## Planned surface (mirrors the current Blink usage in `PROJECT_AUDIT.md` §5)

| Method + path (proposed) | Replaces today's call | Purpose |
|---|---|---|
| `GET /products` | `blink.db.table('products').list({ orderBy: { sortOrder: 'asc' } })` | List all products, ordered by `sortOrder`. Used by catalog + admin (admin includes hidden). |
| `GET /products/:id` | `blink.db.table('products').get(id)` | Fetch one product (detail page). |
| `POST /products` | `blink.db.table('products').create(data)` | Create a product. |
| `PATCH /products/:id` | `blink.db.table('products').update(id, data)` | Update fields (edit, hide-toggle, reorder). |
| `DELETE /products/:id` | `blink.db.table('products').delete(id)` | Delete a product. |
| `POST /uploads` | `blink.storage.upload(file, path)` | Upload an image, return `{ publicUrl }`. |

## Contract rules

- Response shapes must match the `Product` type in `src/types/product.ts` exactly
  (`isHidden` and `sortOrder` as numbers; `imageUrl` as a public URL string).
- `GET /products` for the catalog returns the same data the client filters
  (visibility/category/search filtering stays client-side as it is today, unless
  later moved here deliberately).
- Reordering currently issues two `update` calls swapping `sortOrder`; the API may
  later offer a batch reorder endpoint, but must preserve identical end state.

## Not in scope yet

- Authentication/authorization (the app uses a client-side PIN gate; see audit §6).
- Rate limiting, validation middleware — to be designed alongside the first endpoint.
