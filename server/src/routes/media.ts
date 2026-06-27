/**
 * Media-management admin routes (v1.1) — READ-ONLY observability + reports.
 *
 *   GET /admin/media/stats        -> storage/processing metrics (Observability)
 *   GET /admin/media/garbage      -> orphan / missing / mismatched scan (Dry-Run)
 *   GET /admin/media/integrity    -> per-image health report
 *   GET /admin/media/duplicates   -> SHA-256 duplicate groups
 *
 * These are additive and backward compatible: no existing route or contract
 * changes. They are deliberately read-only — the destructive / mutating
 * operations (garbage-collect execute, thumbnail regeneration) are exposed ONLY
 * through the `npm run media` CLI, so they can't be triggered by an errant GET.
 *
 * NOTE: routes contain NO filesystem/SQL logic — everything goes through
 * MediaService, mirroring the products routes.
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { MediaService } from '../services/media.ts';
import { ProductsService } from '../services/products.ts';

const mediaRoutes: FastifyPluginAsync = async (fastify) => {
  const media = new MediaService(new ProductsService(fastify.db));

  const run = async <T>(label: string, reply: FastifyReply, fn: () => Promise<T>): Promise<T | FastifyReply> => {
    try {
      return await fn();
    } catch (err) {
      fastify.log.error(err, `media: ${label} failed`);
      return reply.code(500).send({ error: 'Internal Server Error', message: `Failed to ${label}` });
    }
  };

  fastify.get('/admin/media/stats', (_req, reply) => run('collect media stats', reply, () => media.collectStats()));
  fastify.get('/admin/media/garbage', (_req, reply) => run('scan for garbage', reply, () => media.scanGarbage()));
  fastify.get('/admin/media/integrity', (_req, reply) => run('check image integrity', reply, () => media.checkIntegrity()));
  fastify.get('/admin/media/duplicates', (_req, reply) => run('detect duplicates', reply, () => media.findDuplicates()));
};

export default mediaRoutes;
