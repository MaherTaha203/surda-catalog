/**
 * Products routes.
 *
 * Read:
 *   GET    /products                  -> Product[]   (all rows, sortOrder asc)
 *   GET    /products/:id              -> Product | 404
 *
 * Admin (write):
 *   POST   /products                  -> 201 Product
 *   POST   /products/bulk             -> 201 Product[]        body: { items: Product[] }
 *   PUT    /products/:id              -> 200 Product | 404
 *   DELETE /products/:id              -> 204 | 404
 *   PATCH  /products/publish          -> 200 { changed }      body: { ids, isHidden? }
 *   PATCH  /products/:id/visibility   -> 200 Product | 404   body: { isHidden } | { hidden }
 *   PATCH  /products/:id/order        -> 200 Product | 404   body: { sortOrder }
 *
 * The JSON shape matches the Blink `Product` exactly (PROJECT_AUDIT.md §5/§8 and
 * ../../../src/types/product.ts). GET /products returns every row (incl. hidden);
 * the client does its own visibility/search filtering.
 *
 * NOTE: routes contain NO SQL — all data access goes through ProductsService.
 */
import type { FastifyPluginAsync } from 'fastify';
import {
  ProductsService,
  type NewProduct,
  type ProductUpdate,
} from '../services/products.ts';
import { StorageService } from '../services/storage.ts';

interface ProductIdParams {
  id: string;
}

// ── Coercion helpers (no SQL — just input normalization) ─────────────────────
// Every numeric product field in this domain (quantities, prices, sortOrder,
// isHidden) is non-negative, so coercion clamps at 0 — a raw API call can't
// store a negative price the UI never allows.
const toStr = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const toInt = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
};
const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};
/** Normalize any truthy/falsy input to the 0|1 the schema stores. */
const toFlag = (v: unknown): number => (toInt(v) ? 1 : 0);

/** Build a NewProduct from a raw body/item (name + category required upstream). */
function buildNewProduct(body: Record<string, unknown>): NewProduct {
  return {
    name: toStr(body.name).trim(),
    description: toStr(body.description),
    size: toStr(body.size),
    cartonQuantity: toInt(body.cartonQuantity),
    cartonPrice: toNum(body.cartonPrice),
    offerPrice: toNum(body.offerPrice),
    offerQuantity: toInt(body.offerQuantity),
    bonusQuantity: toInt(body.bonusQuantity),
    imageUrl: toStr(body.imageUrl),
    category: toStr(body.category).trim(),
    isHidden: toFlag(body.isHidden),
    ...(('sortOrder' in body) ? { sortOrder: toInt(body.sortOrder) } : {}),
  };
}

/** Build a partial update from only the fields present in the body. */
function buildPatch(body: Record<string, unknown>): ProductUpdate {
  const patch: ProductUpdate = {};
  if ('name' in body) patch.name = toStr(body.name);
  if ('description' in body) patch.description = toStr(body.description);
  if ('size' in body) patch.size = toStr(body.size);
  if ('cartonQuantity' in body) patch.cartonQuantity = toInt(body.cartonQuantity);
  if ('cartonPrice' in body) patch.cartonPrice = toNum(body.cartonPrice);
  if ('offerPrice' in body) patch.offerPrice = toNum(body.offerPrice);
  if ('offerQuantity' in body) patch.offerQuantity = toInt(body.offerQuantity);
  if ('bonusQuantity' in body) patch.bonusQuantity = toInt(body.bonusQuantity);
  if ('imageUrl' in body) patch.imageUrl = toStr(body.imageUrl);
  if ('category' in body) patch.category = toStr(body.category);
  if ('isHidden' in body) patch.isHidden = toFlag(body.isHidden);
  if ('sortOrder' in body) patch.sortOrder = toInt(body.sortOrder);
  return patch;
}

const productsRoutes: FastifyPluginAsync = async (fastify) => {
  // `fastify.db` is decorated by the database plugin, registered before this one.
  const products = new ProductsService(fastify.db);
  const storage = new StorageService();

  // ── GET /products ──────────────────────────────────────────────────────────
  fastify.get('/products', async (_request, reply) => {
    try {
      return products.list();
    } catch (err) {
      fastify.log.error(err, 'failed to list products');
      return reply
        .code(500)
        .send({ error: 'Internal Server Error', message: 'Failed to load products' });
    }
  });

  // ── GET /products/:id ──────────────────────────────────────────────────────
  fastify.get<{ Params: ProductIdParams }>('/products/:id', async (request, reply) => {
    const { id } = request.params;
    if (!id || !id.trim()) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Product id is required' });
    }
    try {
      const product = products.get(id);
      if (!product) {
        return reply.code(404).send({ error: 'Not Found', message: `Product '${id}' not found` });
      }
      return product;
    } catch (err) {
      fastify.log.error(err, `failed to get product '${id}'`);
      return reply
        .code(500)
        .send({ error: 'Internal Server Error', message: 'Failed to load product' });
    }
  });

  // ── POST /products ─────────────────────────────────────────────────────────
  fastify.post<{ Body: Record<string, unknown> }>('/products', async (request, reply) => {
    const body = request.body ?? {};
    const name = toStr(body.name).trim();
    const category = toStr(body.category).trim();
    if (!name) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Product name is required' });
    }
    if (!category) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Product category is required' });
    }
    const input: NewProduct = { ...buildNewProduct(body), sortOrder: toInt(body.sortOrder) };
    try {
      const created = products.create(input);
      return reply.code(201).send(created);
    } catch (err) {
      fastify.log.error(err, 'failed to create product');
      return reply
        .code(500)
        .send({ error: 'Internal Server Error', message: 'Failed to create product' });
    }
  });

  // ── POST /products/bulk ────────────────────────────────────────────────────
  // Create many products in one transaction (bulk image-import "create all").
  // Body: { items: NewProduct[] }. Every item needs a name + category; sortOrder
  // is auto-assigned to append after the current catalog when omitted.
  fastify.post<{ Body: { items?: Record<string, unknown>[] } }>('/products/bulk', async (request, reply) => {
    const items = request.body?.items;
    if (!Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({ error: 'Bad Request', message: 'items: Product[] is required' });
    }
    if (items.length > 1000) {
      return reply.code(400).send({ error: 'Bad Request', message: 'الحد الأقصى 1000 منتج في الدفعة الواحدة' });
    }
    const inputs: NewProduct[] = [];
    for (let i = 0; i < items.length; i++) {
      const input = buildNewProduct(items[i] ?? {});
      if (!input.name) {
        return reply.code(400).send({ error: 'Bad Request', message: `المنتج رقم ${i + 1}: الاسم مطلوب` });
      }
      if (!input.category) {
        return reply.code(400).send({ error: 'Bad Request', message: `المنتج رقم ${i + 1}: التصنيف مطلوب` });
      }
      inputs.push(input);
    }
    try {
      const created = products.createMany(inputs, products.count());
      return reply.code(201).send(created);
    } catch (err) {
      fastify.log.error(err, 'failed to bulk-create products');
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to create products' });
    }
  });

  // ── PATCH /products/publish ────────────────────────────────────────────────
  // Bulk visibility toggle (quick-entry "publish all drafts"). Body:
  // { ids: string[], isHidden?: 0|1 } — defaults to publishing (isHidden = 0).
  fastify.patch<{ Body: { ids?: unknown; isHidden?: unknown } }>('/products/publish', async (request, reply) => {
    const rawIds = request.body?.ids;
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return reply.code(400).send({ error: 'Bad Request', message: 'ids: string[] is required' });
    }
    const ids = rawIds.filter((v): v is string => typeof v === 'string' && v.length > 0);
    const isHidden = 'isHidden' in (request.body ?? {}) ? toFlag(request.body?.isHidden) : 0;
    try {
      const changed = products.setVisibilityMany(ids, isHidden);
      return { changed };
    } catch (err) {
      fastify.log.error(err, 'failed to bulk-publish products');
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to publish products' });
    }
  });

  // ── PUT /products/:id ──────────────────────────────────────────────────────
  fastify.put<{ Params: ProductIdParams; Body: Record<string, unknown> }>(
    '/products/:id',
    async (request, reply) => {
      const { id } = request.params;
      const patch = buildPatch(request.body ?? {});
      if ('name' in patch && !String(patch.name).trim()) {
        return reply.code(400).send({ error: 'Bad Request', message: 'Product name cannot be empty' });
      }
      try {
        const existing = products.get(id);
        const updated = products.update(id, patch);
        if (!updated) {
          return reply.code(404).send({ error: 'Not Found', message: `Product '${id}' not found` });
        }
        // The image was replaced or cleared — remove the old file only AFTER the
        // row update succeeded, so a failed update can never leave the product
        // pointing at an already-deleted file (best-effort, like DELETE below).
        if (existing?.imageUrl && 'imageUrl' in patch && existing.imageUrl !== updated.imageUrl) {
          await storage.deleteByUrl(existing.imageUrl);
        }
        return updated;
      } catch (err) {
        fastify.log.error(err, `failed to update product '${id}'`);
        return reply
          .code(500)
          .send({ error: 'Internal Server Error', message: 'Failed to update product' });
      }
    },
  );

  // ── DELETE /products/:id ───────────────────────────────────────────────────
  fastify.delete<{ Params: ProductIdParams }>('/products/:id', async (request, reply) => {
    const { id } = request.params;
    try {
      const existing = products.get(id);
      const removed = products.delete(id);
      if (!removed) {
        return reply.code(404).send({ error: 'Not Found', message: `Product '${id}' not found` });
      }
      // Remove the product's local image file, if any.
      await storage.deleteByUrl(existing?.imageUrl);
      return reply.code(204).send();
    } catch (err) {
      fastify.log.error(err, `failed to delete product '${id}'`);
      return reply
        .code(500)
        .send({ error: 'Internal Server Error', message: 'Failed to delete product' });
    }
  });

  // ── PATCH /products/:id/visibility ─────────────────────────────────────────
  fastify.patch<{ Params: ProductIdParams; Body: Record<string, unknown> }>(
    '/products/:id/visibility',
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body ?? {};
      // Accept { isHidden: 0|1 } or { hidden: boolean }.
      let isHidden: number;
      if ('isHidden' in body) {
        isHidden = toInt(body.isHidden) ? 1 : 0;
      } else if ('hidden' in body) {
        isHidden = body.hidden ? 1 : 0;
      } else {
        return reply
          .code(400)
          .send({ error: 'Bad Request', message: 'Provide isHidden (0|1) or hidden (boolean)' });
      }
      try {
        const updated = products.setVisibility(id, isHidden);
        if (!updated) {
          return reply.code(404).send({ error: 'Not Found', message: `Product '${id}' not found` });
        }
        return updated;
      } catch (err) {
        fastify.log.error(err, `failed to set visibility for '${id}'`);
        return reply
          .code(500)
          .send({ error: 'Internal Server Error', message: 'Failed to update visibility' });
      }
    },
  );

  // ── PATCH /products/reorder ────────────────────────────────────────────────
  // Atomic multi-item reorder (all-or-nothing). Body: { items: [{ id, sortOrder }] }.
  fastify.patch<{ Body: { items?: { id: string; sortOrder: number }[] } }>(
    '/products/reorder',
    async (request, reply) => {
      const items = request.body?.items;
      if (!Array.isArray(items) || items.length === 0) {
        return reply
          .code(400)
          .send({ error: 'Bad Request', message: 'items: [{ id, sortOrder }] is required' });
      }
      const clean = items
        .filter((it) => it && typeof it.id === 'string')
        .map((it) => ({ id: it.id, sortOrder: toInt(it.sortOrder) }));
      try {
        return products.reorder(clean);
      } catch (err) {
        fastify.log.error(err, 'failed to reorder products');
        return reply
          .code(500)
          .send({ error: 'Internal Server Error', message: 'Failed to reorder products' });
      }
    },
  );

  // ── PATCH /products/:id/order ──────────────────────────────────────────────
  fastify.patch<{ Params: ProductIdParams; Body: Record<string, unknown> }>(
    '/products/:id/order',
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body ?? {};
      if (!('sortOrder' in body)) {
        return reply.code(400).send({ error: 'Bad Request', message: 'sortOrder is required' });
      }
      const sortOrder = toInt(body.sortOrder);
      try {
        const updated = products.setOrder(id, sortOrder);
        if (!updated) {
          return reply.code(404).send({ error: 'Not Found', message: `Product '${id}' not found` });
        }
        return updated;
      } catch (err) {
        fastify.log.error(err, `failed to set order for '${id}'`);
        return reply
          .code(500)
          .send({ error: 'Internal Server Error', message: 'Failed to update order' });
      }
    },
  );
};

export default productsRoutes;
