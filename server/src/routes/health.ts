/**
 * Health route — the ONLY endpoint in this foundation phase.
 *
 *   GET /health  ->  { "status": "ok" }
 */
import type { FastifyPluginAsync } from 'fastify';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });
};

export default healthRoutes;
