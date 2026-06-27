/**
 * Fastify application factory.
 *
 * Builds the server instance and registers plugins + routes. Kept separate from
 * `index.ts` (which only starts listening) so the app can be constructed for
 * tests or scripts without binding a port.
 */
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import databasePlugin from './plugins/database.ts';
import healthRoutes from './routes/health.ts';
import productsRoutes from './routes/products.ts';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // CORS — lets the browser frontend (a different origin in dev / on the tablets)
  // call this API. Restrict with CORS_ORIGIN (comma-separated) or default to
  // reflecting any origin for this small single-tenant deployment.
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : true;
  app.register(cors, { origin: corsOrigin });

  // Plugins (database decorates `fastify.db`, auto-initializing catalog.db).
  app.register(databasePlugin);

  // Routes.
  app.register(healthRoutes);
  app.register(productsRoutes);

  return app;
}
