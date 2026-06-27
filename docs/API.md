# API Reference

Base URL: the Fastify server (default `http://localhost:4000`; set via `PORT`/`HOST`).
The frontend points at it via `VITE_API_URL`.

All responses are JSON unless noted. CORS is enabled (`CORS_ORIGIN` to restrict).
Security headers are set by `@fastify/helmet`.

## Product object

```jsonc
{
  "id": "string",            // UUID, server-generated
  "name": "string",
  "description": "string",
  "size": "string",          // empty for category "أدوات التنظيف"
  "cartonQuantity": 0,       // integer
  "cartonPrice": 0,          // number (may be decimal)
  "imageUrl": "string",      // "/uploads/products/<file>" or "" (relative)
  "category": "مواد التنظيف" | "أدوات التنظيف",
  "isHidden": 0,             // 0 = visible, 1 = hidden
  "sortOrder": 0,            // integer, ascending
  "createdAt": "ISO string",
  "updatedAt": "ISO string"
}
```

## Endpoints

### `GET /health`
`200 → { "status": "ok" }`

### `GET /products`
All products ordered by `sortOrder` asc, **including hidden** (the client filters for the
catalog). `200 → Product[]`.

### `GET /products/:id`
`200 → Product` · `404 → { error, message }`.

### `POST /products`
Create. Body: product fields (`name` and `category` required; the rest default to empty/0).
Server generates `id`, `createdAt`, `updatedAt`.
`201 → Product` · `400` if `name`/`category` missing.

### `PUT /products/:id`
Update provided fields (partial). Preserves `id`/`createdAt`, refreshes `updatedAt`.
`200 → Product` · `404` · `400` if `name` is sent empty.

### `DELETE /products/:id`
Deletes the product **and its local image file**. `204` · `404`.

### `PATCH /products/:id/visibility`
Body `{ "isHidden": 0|1 }` or `{ "hidden": true|false }`. `200 → Product` · `400` · `404`.

### `PATCH /products/:id/order`
Body `{ "sortOrder": number }`. `200 → Product` · `400` · `404`.

### `PATCH /products/reorder`
Atomic multi-item reorder (single transaction).
Body `{ "items": [ { "id": "...", "sortOrder": 0 }, … ] }`.
`200 → Product[]` (new order) · `400` if `items` missing/empty.

### `POST /upload`
`multipart/form-data`, field **`file`**. Validates mime type, extension, size
(`UPLOAD_MAX_BYTES`, default 5 MB) **and file magic bytes** (must be a real
JPEG/PNG/WEBP/GIF). Stores under `server/uploads/products/` with a UUID filename.
Optional query `?oldImageUrl=/uploads/products/<old>` deletes the previous image.
`201 → { url, filename, bytes }` · `400` (bad type/content) · `413` (too large).

### `GET /uploads/products/:file`
Static image serving (`@fastify/static`).

## Error shape
Non-2xx responses are `{ "error": "<Reason>", "message": "<detail>" }` (except `204`).
