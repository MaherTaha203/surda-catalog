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
const API_PREFIXES = ['/products', '/upload', '/uploads', '/health', '/admin/media', '/catalog-settings'];

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

  // The SPA fallback document for client-side routes that are NOT prerendered
  // (dynamic routes like /product/:id, opened directly or refreshed).
  //
  // It MUST be the route-agnostic SPA SHELL (`_shell.html`), NOT the `/`
  // prerender (`index.html`). `index.html` is the landing route's SSR output
  // (it contains the landing spinner markup + the router state for `/`); serving
  // it for /product/:id made the client hydrate the product route against the
  // landing DOM → React #418 hydration mismatch. `_shell.html` renders the root
  // layout with an EMPTY router outlet, so it hydrates identically on any URL and
  // the client then resolves the real route — no mismatch. Falls back to
  // index.html only if the shell is absent (e.g. an older build without SPA mode).
  const shellPath = join(FRONTEND_DIST, '_shell.html');
  const shellHtml = readFileSync(existsSync(shellPath) ? shellPath : indexPath);

  // SPA fallback: an unmatched GET for a NAVIGATION route (extensionless, e.g.
  // /catalog, /product/:id) returns the app shell so deep links / client routes
  // load. It must NOT return the shell for a missing static ASSET (a hashed
  // bundle under /assets/, or any path with a file extension): a request for a
  // `.js` chunk that 404s would otherwise get `text/html` with a 200, and the
  // browser's `import()` throws "'text/html' is not a valid JavaScript MIME type"
  // (and a Service Worker could cache that HTML as the chunk). Such a request —
  // typically a stale chunk hash after a redeploy — must get a real 404 so the
  // import fails cleanly. API paths keep their JSON 404 as before.
  const looksLikeAsset = (path: string): boolean =>
    path.startsWith('/assets/') || /\.[a-z0-9]+$/i.test(path);

  fastify.setNotFoundHandler((request, reply) => {
    const url = request.raw.url ?? '';
    const path = url.split(/[?#]/)[0];
    const isApi = API_PREFIXES.some(
      (p) => url === p || url.startsWith(`${p}/`) || url.startsWith(`${p}?`),
    );
    if (request.method === 'GET' && !isApi && !looksLikeAsset(path)) {
      return reply.code(200).type('text/html').send(shellHtml);
    }
    return reply
      .code(404)
      .send({ error: 'Not Found', message: `Route ${request.method} ${url} not found` });
  });

  fastify.log.info(`serving static frontend from ${FRONTEND_DIST}`);
};

export default fp(frontendPlugin, { name: 'frontend' });
