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
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { mkdirSync } from 'node:fs';
import databasePlugin from './plugins/database.ts';
import healthRoutes from './routes/health.ts';
import productsRoutes from './routes/products.ts';
import uploadRoute from './routes/upload.ts';
import { UPLOADS_BASE, MAX_BYTES } from './services/storage.ts';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
    // Be forgiving about a trailing slash so `/health` and `/health/` both match
    // (a proxy or browser may append one) instead of returning a 404.
    ignoreTrailingSlash: true,
  });

  // Security headers. CSP is disabled (this is a JSON/image API, not an HTML app)
  // and Cross-Origin-Resource-Policy is set to cross-origin so the frontend (a
  // different origin) can load product images served from /uploads.
  app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  });

  // CORS — lets the browser frontend (a different origin in dev / on the tablets)
  // call this API. Restrict with CORS_ORIGIN (comma-separated) or default to
  // reflecting any origin for this small single-tenant deployment.
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : true;
  app.register(cors, { origin: corsOrigin });

  // Multipart uploads (image upload route).
  app.register(multipart, { limits: { fileSize: MAX_BYTES, files: 1 } });

  // Serve stored images statically at /uploads/products/<file>.
  mkdirSync(UPLOADS_BASE, { recursive: true });
  app.register(fastifyStatic, { root: UPLOADS_BASE, prefix: '/uploads/' });

  // Plugins (database decorates `fastify.db`, auto-initializing catalog.db).
  app.register(databasePlugin);

  // Routes.
  app.register(healthRoutes);
  app.register(productsRoutes);
  app.register(uploadRoute);

  return app;
}
