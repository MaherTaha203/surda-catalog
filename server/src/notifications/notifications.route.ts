/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible).
 *
 * Fastify plugin exposing the notifications API. Registered once from app.ts
 * (two clearly-marked lines). The API lives under /notifications-api so it never
 * collides with the manager PAGE route /notifications (same split as
 * /catalog-settings vs the /settings page).
 *
 *   GET   /notifications-api                 -> NotificationRow[]  (manager: all)
 *   GET   /notifications-api?device_id=<id>  -> NotificationRow[]  (delegate: mine + broadcast)
 *   GET   /notifications-api/:id             -> NotificationRow | 404
 *   POST  /notifications-api                 -> 201 NotificationRow
 *   PATCH /notifications-api/:id/read        -> 200 NotificationRow | 404
 *   PATCH /notifications-api/:id/done        -> 200 NotificationRow | 404
 *
 * NOTE: no SQL here — all data access goes through NotificationsService.
 */
import type { FastifyPluginAsync } from 'fastify';
import { NotificationsService, type NewNotification } from './notifications.service.ts';

interface IdParams {
  id: string;
}

const toStr = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

const notificationsRoutes: FastifyPluginAsync = async (fastify) => {
  const notifications = new NotificationsService(fastify.db);

  // ── GET /notifications ──────────────────────────────────────────────────────
  fastify.get<{ Querystring: { device_id?: string } }>(
    '/notifications-api',
    async (request, reply) => {
      try {
        const deviceId = request.query?.device_id?.trim();
        return deviceId ? notifications.listForDevice(deviceId) : notifications.listAll();
      } catch (err) {
        fastify.log.error(err, 'failed to list notifications');
        return reply
          .code(500)
          .send({ error: 'Internal Server Error', message: 'Failed to load notifications' });
      }
    },
  );

  // ── GET /notifications/:id ──────────────────────────────────────────────────
  fastify.get<{ Params: IdParams }>('/notifications-api/:id', async (request, reply) => {
    try {
      const row = notifications.get(request.params.id);
      if (!row) {
        return reply.code(404).send({ error: 'Not Found', message: 'Notification not found' });
      }
      return row;
    } catch (err) {
      fastify.log.error(err, 'failed to get notification');
      return reply
        .code(500)
        .send({ error: 'Internal Server Error', message: 'Failed to load notification' });
    }
  });

  // ── POST /notifications ─────────────────────────────────────────────────────
  fastify.post<{ Body: Record<string, unknown> }>('/notifications-api', async (request, reply) => {
    const body = request.body ?? {};
    const type = toStr(body.type).trim();
    const title = toStr(body.title).trim();
    if (!NotificationsService.isValidType(type)) {
      return reply
        .code(400)
        .send({ error: 'Bad Request', message: 'نوع الإشعار غير صالح' });
    }
    if (!title) {
      return reply.code(400).send({ error: 'Bad Request', message: 'العنوان مطلوب' });
    }
    const input: NewNotification = {
      type,
      title,
      message: toStr(body.message),
      device_id: toStr(body.device_id),
      customer_id: body.customer_id ? toStr(body.customer_id) : null,
      product_id: body.product_id ? toStr(body.product_id) : null,
    };
    try {
      return reply.code(201).send(notifications.create(input));
    } catch (err) {
      fastify.log.error(err, 'failed to create notification');
      return reply
        .code(500)
        .send({ error: 'Internal Server Error', message: 'Failed to create notification' });
    }
  });

  // ── PATCH /notifications/:id/read ───────────────────────────────────────────
  fastify.patch<{ Params: IdParams }>('/notifications-api/:id/read', async (request, reply) => {
    try {
      const updated = notifications.markRead(request.params.id);
      if (!updated) {
        return reply.code(404).send({ error: 'Not Found', message: 'Notification not found' });
      }
      return updated;
    } catch (err) {
      fastify.log.error(err, 'failed to mark notification read');
      return reply
        .code(500)
        .send({ error: 'Internal Server Error', message: 'Failed to update notification' });
    }
  });

  // ── PATCH /notifications/:id/done ───────────────────────────────────────────
  fastify.patch<{ Params: IdParams }>('/notifications-api/:id/done', async (request, reply) => {
    try {
      const updated = notifications.markDone(request.params.id);
      if (!updated) {
        return reply.code(404).send({ error: 'Not Found', message: 'Notification not found' });
      }
      return updated;
    } catch (err) {
      fastify.log.error(err, 'failed to mark notification done');
      return reply
        .code(500)
        .send({ error: 'Internal Server Error', message: 'Failed to update notification' });
    }
  });
};

export default notificationsRoutes;
