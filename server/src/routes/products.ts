/**
 * Products routes.
 *
 * Read:
 *   GET    /products                  -> Product[]   (all rows, sortOrder asc)
 *   GET    /products/:id              -> Product | 404
 *
 * Admin (write):
 *   POST   /products                  -> 201 Product
 *   PUT    /products/:id              -> 200 Product | 404
 *   DELETE /products/:id              -> 204 | 404
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

interface ProductIdParams {
  id: string;
}

// ── Coercion helpers (no SQL — just input normalization) ─────────────────────
const toStr = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const toInt = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Build a partial update from only the fields present in the body. */
function buildPatch(body: Record<string, unknown>): ProductUpdate {
  const patch: ProductUpdate = {};
  if ('name' in body) patch.name = toStr(body.name);
  if ('description' in body) patch.description = toStr(body.description);
  if ('size' in body) patch.size = toStr(body.size);
  if ('cartonQuantity' in body) patch.cartonQuantity = toInt(body.cartonQuantity);
  if ('cartonPrice' in body) patch.cartonPrice = toNum(body.cartonPrice);
  if ('imageUrl' in body) patch.imageUrl = toStr(body.imageUrl);
  if ('category' in body) patch.category = toStr(body.category);
  if ('isHidden' in body) patch.isHidden = toInt(body.isHidden);
  if ('sortOrder' in body) patch.sortOrder = toInt(body.sortOrder);
  return patch;
}

const productsRoutes: FastifyPluginAsync = async (fastify) => {
  // `fastify.db` is decorated by the database plugin, registered before this one.
  const products = new ProductsService(fastify.db);

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
    const input: NewProduct = {
      name,
      description: toStr(body.description),
      size: toStr(body.size),
      cartonQuantity: toInt(body.cartonQuantity),
      cartonPrice: toNum(body.cartonPrice),
      imageUrl: toStr(body.imageUrl),
      category,
      isHidden: toInt(body.isHidden),
      sortOrder: toInt(body.sortOrder),
    };
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
        const updated = products.update(id, patch);
        if (!updated) {
          return reply.code(404).send({ error: 'Not Found', message: `Product '${id}' not found` });
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
      const removed = products.delete(id);
      if (!removed) {
        return reply.code(404).send({ error: 'Not Found', message: `Product '${id}' not found` });
      }
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
