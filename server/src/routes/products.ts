/**
 * Products routes (read-only).
 *
 *   GET /products       -> Product[]            (all rows, ordered by sortOrder asc)
 *   GET /products/:id    -> Product | 404
 *
 * The JSON returned matches EXACTLY what Blink returns today (see PROJECT_AUDIT.md
 * §5/§8 and the `Product` interface in ../../../src/types/product.ts):
 *   - GET /products      mirrors `blink.db.table('products').list({ orderBy: { sortOrder: 'asc' } })`
 *     — every row, including hidden ones; the client does its own visibility/search filtering.
 *   - GET /products/:id  mirrors `blink.db.table('products').get(id)` — the bare product object.
 *
 * NOTE: routes contain NO SQL. All data access goes through ProductsService.
 * Create/update/delete and image upload are intentionally NOT implemented here.
 */
import type { FastifyPluginAsync } from 'fastify';
import { ProductsService } from '../services/products.ts';

interface ProductIdParams {
  id: string;
}

const productsRoutes: FastifyPluginAsync = async (fastify) => {
  // `fastify.db` is decorated by the database plugin, registered before this one.
  const products = new ProductsService(fastify.db);

  // GET /products — list all products ordered by sortOrder asc.
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

  // GET /products/:id — a single product, or 404 if it does not exist.
  fastify.get<{ Params: ProductIdParams }>('/products/:id', async (request, reply) => {
    const { id } = request.params;

    if (!id || !id.trim()) {
      return reply
        .code(400)
        .send({ error: 'Bad Request', message: 'Product id is required' });
    }

    try {
      const product = products.get(id);
      if (!product) {
        return reply
          .code(404)
          .send({ error: 'Not Found', message: `Product '${id}' not found` });
      }
      return product;
    } catch (err) {
      fastify.log.error(err, `failed to get product '${id}'`);
      return reply
        .code(500)
        .send({ error: 'Internal Server Error', message: 'Failed to load product' });
    }
  });
};

export default productsRoutes;
