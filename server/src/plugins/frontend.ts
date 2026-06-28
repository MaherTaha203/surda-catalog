/**
 * Frontend-serving plugin (deployment only).
 *
 * In production the whole app runs as a SINGLE service: this Fastify server
 * serves the API + /uploads AND the pre-built static React app (`dist/`). Because
 * the frontend and API share one origin, the app's same-origin relative URLs
 * (`/products`, `/upload`, `/uploads`, ...) "just work" — no API origin, no CORS,
 * no localhost.
 *
 * This changes NO API/route/model/engine behaviour. It only adds:
 *   - static serving of the built client assets at `/`
 *   - an SPA fallback so client-side routes (/catalog, /admin, /product/:id) load
 *     index.html, while unknown API paths still return a JSON 404.
 *
 * If `dist/` is absent (e.g. local API-only dev where Vite serves the UI on :3000),
 * the plugin is a no-op and the server behaves exactly as before.
 *
 * `FRONTEND_DIST` overrides the location; default is `../dist` relative to the
 * server's working dir (the repo layout: <root>/dist + <root>/server).
 */
import fp from 'fastify-plugin';
import fastifyStatic from '@fastify/static';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { FastifyPluginAsync } from 'fastify';

/** API path prefixes that must keep their JSON 404 (never fall back to the SPA). */
const API_PREFIXES = ['/products', '/upload', '/uploads', '/health', '/admin/media'];

const FRONTEND_DIST =
  process.env.FRONTEND_DIST || resolve(process.cwd(), '..', 'dist');

const frontendPlugin: FastifyPluginAsync = async (fastify) => {
  const indexPath = join(FRONTEND_DIST, 'index.html');
  if (!existsSync(indexPath)) {
    fastify.log.warn(
      `frontend dist not found at ${FRONTEND_DIST} — serving API only (build with "npm run build")`,
    );
    return;
  }

  // Serve the hashed assets / static files. A second @fastify/static instance
  // (the first serves /uploads), so decorateReply:false to avoid re-decorating.
  fastify.register(fastifyStatic, {
    root: FRONTEND_DIST,
    prefix: '/',
    decorateReply: false,
    index: ['index.html'],
  });

  // Cache index.html once; it's the SPA shell for every client-side route.
  const indexHtml = readFileSync(indexPath);

  // SPA fallback: any unmatched GET that isn't an API path returns the app shell,
  // so deep links / client routes load. Specific API routes are matched before
  // this handler runs; unknown API paths still get a JSON 404.
  fastify.setNotFoundHandler((request, reply) => {
    const url = request.raw.url ?? '';
    const isApi = API_PREFIXES.some(
      (p) => url === p || url.startsWith(`${p}/`) || url.startsWith(`${p}?`),
    );
    if (request.method === 'GET' && !isApi) {
      return reply.code(200).type('text/html').send(indexHtml);
    }
    return reply
      .code(404)
      .send({ error: 'Not Found', message: `Route ${request.method} ${url} not found` });
  });

  fastify.log.info(`serving static frontend from ${FRONTEND_DIST}`);
};

export default fp(frontendPlugin, { name: 'frontend' });
