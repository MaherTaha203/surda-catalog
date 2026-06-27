/**
 * Server entry point — starts the Fastify app.
 *
 * Run with `npm run server` (from the repo root) or `npm start` (from server/).
 * On boot the database plugin auto-creates `catalog.db` and the `products`
 * table if they do not exist.
 */
import { buildApp } from './app.ts';

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

const app = buildApp();

async function start(): Promise<void> {
  try {
    await app.listen({ port: PORT, host: HOST });
    // Fastify's logger already prints "Server listening at http://...".
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown — close Fastify (and the DB via its onClose hook).
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    process.exit(0);
  });
}

void start();
