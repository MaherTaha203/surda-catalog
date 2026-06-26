# `server/storage/` — Image storage (future)

> **Status: scaffolding only.** No storage code exists yet. `blink.storage` is still live.

## Future responsibility

Replace `blink.storage`. Accept an uploaded image file, persist it, and return a
**public URL** that gets stored verbatim in `products.imageUrl`.

## What it must replicate (see `PROJECT_AUDIT.md` §7)

The **only** upload call today is in `src/components/AdminProductForm.tsx`:

```ts
const { publicUrl } = await blink.storage.upload(file, `products/${Date.now()}.${ext}`);
```

So the replacement must:

1. Accept an image `File` (chosen via `<input type="file" accept="image/*">`).
2. Store it under a `products/` prefix with a unique key (timestamp-based today).
3. Return `{ publicUrl }` — a directly-usable `<img src>` URL (no signing/expiry,
   matching current behavior).

## Retrieval

Images are read straight from `product.imageUrl` as `<img src>` in `ProductCard`,
`AdminProductRow`, `product.$id`, and `ImageViewer`. No transforms/resizing today, so
the storage layer just needs to serve stable public URLs.

## Migration of existing images

The `sync/` layer will copy existing Blink-hosted images into the local uploads folder and
rewrite each product's `imageUrl`. `src/lib/backup.ts` already base64-embeds all product
images in a JSON export and can act as a portable source for this migration.

## Notes

- **Local uploads folder served by Fastify as static files** (decided architecture — no
  cloud bucket). The served path is the `publicUrl`; keep paths stable after cutover.
- The company logo (`localStorage['sarda_company_logo']`) is **not** uploaded through
  Blink today and is out of scope for this layer.
