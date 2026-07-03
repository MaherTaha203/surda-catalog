/**
 * Catalog settings routes.
 *
 *   GET /catalog-settings   -> CatalogSettings   (public — the catalog reads these)
 *   PUT /catalog-settings   -> CatalogSettings   (admin UI; body: partial settings)
 *
 * Named /catalog-settings (not /settings) because the frontend serves its own
 * /settings PAGE from the same origin in production.
 *
 * When the default product image is replaced or cleared, the previous file is
 * deleted only AFTER the settings row update succeeds (same ordering rule as
 * product image replacement — a failed write never orphans the live reference).
 *
 * NOTE: routes contain NO SQL — all data access goes through SettingsService.
 */
import type { FastifyPluginAsync } from 'fastify';
import { SettingsService, type CatalogSettings } from '../services/settings.ts';
import { StorageService } from '../services/storage.ts';

const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  const settings = new SettingsService(fastify.db);
  const storage = new StorageService();

  fastify.get('/catalog-settings', async (_request, reply) => {
    try {
      return settings.getAll();
    } catch (err) {
      fastify.log.error(err, 'failed to load settings');
      return reply
        .code(500)
        .send({ error: 'Internal Server Error', message: 'Failed to load settings' });
    }
  });

  fastify.put<{ Body: Record<string, unknown> }>('/catalog-settings', async (request, reply) => {
    const body = request.body ?? {};
    const patch: Partial<CatalogSettings> = {};
    if ('showPrices' in body) patch.showPrices = Boolean(body.showPrices);
    if ('allowRepPriceToggle' in body) patch.allowRepPriceToggle = Boolean(body.allowRepPriceToggle);
    if ('defaultProductImageUrl' in body) {
      patch.defaultProductImageUrl =
        body.defaultProductImageUrl === null || body.defaultProductImageUrl === undefined
          ? ''
          : String(body.defaultProductImageUrl);
    }
    if (Object.keys(patch).length === 0) {
      return reply
        .code(400)
        .send({ error: 'Bad Request', message: 'No recognized settings in body' });
    }
    try {
      const before = settings.getAll();
      const updated = settings.update(patch);
      // Default image replaced/cleared → remove the old file (best-effort).
      if (
        'defaultProductImageUrl' in patch &&
        before.defaultProductImageUrl &&
        before.defaultProductImageUrl !== updated.defaultProductImageUrl
      ) {
        await storage.deleteByUrl(before.defaultProductImageUrl);
      }
      return updated;
    } catch (err) {
      fastify.log.error(err, 'failed to update settings');
      return reply
        .code(500)
        .send({ error: 'Internal Server Error', message: 'Failed to update settings' });
    }
  });
};

export default settingsRoutes;
