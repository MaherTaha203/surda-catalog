/**
 * Fastify plugin — opens the SQLite database (auto-creating it + the schema) and
 * decorates the instance as `fastify.db`, available to every route/service.
 *
 * Wrapped in `fastify-plugin` so the decorator escapes plugin encapsulation and
 * is visible app-wide. Closes the connection on server shutdown.
 */
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { initDatabase } from '../database/index.ts';

declare module 'fastify' {
  interface FastifyInstance {
    db: DatabaseSync;
  }
}

const databasePlugin: FastifyPluginAsync = async (fastify) => {
  const { db, dbPath, created } = initDatabase();

  fastify.log.info(
    `SQLite ready at ${dbPath}${created ? ' (created new catalog.db)' : ''}`,
  );

  fastify.decorate('db', db);

  fastify.addHook('onClose', async () => {
    db.close();
  });
};

export default fp(databasePlugin, { name: 'database' });
