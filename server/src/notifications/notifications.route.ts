/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * Fastify plugin exposing the notifications API under /notifications-api (kept
 * distinct from the /notifications page route, like /catalog-settings vs the
 * /settings page).
 *
 *   GET    /notifications-api                 -> NotificationRow[]  (manager: all)
 *   GET    /notifications-api?device_id=<id>  -> NotificationRow[]  (delegate feed)
 *   GET    /notifications-api/:id             -> NotificationRow | 404
 *   POST   /notifications-api                 -> 201 NotificationRow          (admin)
 *   PUT    /notifications-api/:id             -> 200 | 404 | 409 (only status=new) (admin)
 *   DELETE /notifications-api/:id             -> 204 | 404 | 409 (only status=new) (admin)
 *   PATCH  /notifications-api/:id/read        -> 200 | 404   body:{device_id}   (rep)
 *   PATCH  /notifications-api/:id/complete    -> 200 | 404   body:{device_id}   (rep)
 *   PATCH  /notifications-api/:id/cancel      -> 200 | 404                       (admin)
 *   POST   /notifications-api/attachment      -> 201 { path, type, bytes }       (admin)
 *   GET    /notifications-api/devices         -> DeviceRow[]
 *   POST   /notifications-api/devices         -> 200 DeviceRow  body:{device_id, device_name}
 *
 * Security (spec §17): admin-only actions (create/edit/cancel/delete) are gated
 * on the client by the same PIN that guards the whole admin panel — this app has
 * no server-side auth (the PIN is a device-level client gate). The server still
 * enforces the real state rules: edit/delete only while status = 'new'.
 *
 * NOTE: no SQL here — all data access goes through NotificationsService.
 */
import type { FastifyPluginAsync } from 'fastify';
import { NotificationsService, type NewNotification, type NotificationEdit } from './notifications.service.ts';
import { AttachmentStorage, AttachmentValidationError, ATTACHMENT_MAX_BYTES } from './attachment-storage.ts';

interface IdParams {
  id: string;
}

const toStr = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

const notificationsRoutes: FastifyPluginAsync = async (fastify) => {
  const notifications = new NotificationsService(fastify.db);
  const attachments = new AttachmentStorage();

  // ── Device registry ─────────────────────────────────────────────────────────
  fastify.get('/notifications-api/devices', async (_request, reply) => {
    try {
      return notifications.listDevices();
    } catch (err) {
      fastify.log.error(err, 'failed to list devices');
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to load devices' });
    }
  });

  fastify.post<{ Body: Record<string, unknown> }>('/notifications-api/devices', async (request, reply) => {
    const body = request.body ?? {};
    const deviceId = toStr(body.device_id).trim();
    const deviceName = toStr(body.device_name).trim();
    if (!deviceId) return reply.code(400).send({ error: 'Bad Request', message: 'device_id مطلوب' });
    if (!deviceName) return reply.code(400).send({ error: 'Bad Request', message: 'اسم الجهاز مطلوب' });
    try {
      return notifications.registerDevice(deviceId, deviceName);
    } catch (err) {
      fastify.log.error(err, 'failed to register device');
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to register device' });
    }
  });

  // ── Attachment upload (statement) ────────────────────────────────────────────
  fastify.post('/notifications-api/attachment', async (request, reply) => {
    let data;
    try {
      data = await request.file();
    } catch (err) {
      fastify.log.warn(err, 'attachment multipart parse failed');
      return reply.code(400).send({ error: 'Bad Request', message: 'رفع غير صالح' });
    }
    if (!data) return reply.code(400).send({ error: 'Bad Request', message: 'لا يوجد ملف (الحقل "file")' });
    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
    } catch {
      return reply.code(413).send({ error: 'Payload Too Large', message: `الحجم الأقصى ${ATTACHMENT_MAX_BYTES} بايت` });
    }
    try {
      return reply.code(201).send(await attachments.save(buffer));
    } catch (err) {
      if (err instanceof AttachmentValidationError) {
        return reply.code(400).send({ error: 'Bad Request', message: err.message });
      }
      fastify.log.error(err, 'attachment upload failed');
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to store attachment' });
    }
  });

  // ── List ─────────────────────────────────────────────────────────────────────
  fastify.get<{ Querystring: { device_id?: string } }>('/notifications-api', async (request, reply) => {
    try {
      const deviceId = request.query?.device_id?.trim();
      return deviceId ? notifications.listForDevice(deviceId) : notifications.listAll();
    } catch (err) {
      fastify.log.error(err, 'failed to list notifications');
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to load notifications' });
    }
  });

  fastify.get<{ Params: IdParams }>('/notifications-api/:id', async (request, reply) => {
    try {
      const row = notifications.get(request.params.id);
      if (!row) return reply.code(404).send({ error: 'Not Found', message: 'Notification not found' });
      return row;
    } catch (err) {
      fastify.log.error(err, 'failed to get notification');
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to load notification' });
    }
  });

  // ── Create (admin) ─────────────────────────────────────────────────────────────
  fastify.post<{ Body: Record<string, unknown> }>('/notifications-api', async (request, reply) => {
    const body = request.body ?? {};
    const type = toStr(body.type).trim();
    const title = toStr(body.title).trim();
    if (!NotificationsService.isValidType(type)) {
      return reply.code(400).send({ error: 'Bad Request', message: 'نوع الإشعار غير صالح' });
    }
    if (!title) return reply.code(400).send({ error: 'Bad Request', message: 'العنوان مطلوب' });
    const input: NewNotification = {
      type,
      title,
      message: toStr(body.message),
      device_id: toStr(body.device_id),
      device_name: toStr(body.device_name),
      customer_id: body.customer_id ? toStr(body.customer_id) : null,
      product_id: body.product_id ? toStr(body.product_id) : null,
      attachment_path: body.attachment_path ? toStr(body.attachment_path) : null,
      attachment_type: body.attachment_type ? toStr(body.attachment_type) : null,
    };
    try {
      return reply.code(201).send(notifications.create(input));
    } catch (err) {
      fastify.log.error(err, 'failed to create notification');
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to create notification' });
    }
  });

  // ── Edit (admin, only while status = new) ────────────────────────────────────
  fastify.put<{ Params: IdParams; Body: Record<string, unknown> }>('/notifications-api/:id', async (request, reply) => {
    const body = request.body ?? {};
    try {
      const existing = notifications.get(request.params.id);
      if (!existing) return reply.code(404).send({ error: 'Not Found', message: 'Notification not found' });
      if (existing.status !== 'new') {
        return reply.code(409).send({ error: 'Conflict', message: 'لا يمكن تعديل إشعار بعد قراءته' });
      }
      if ('type' in body && !NotificationsService.isValidType(toStr(body.type).trim())) {
        return reply.code(400).send({ error: 'Bad Request', message: 'نوع الإشعار غير صالح' });
      }
      if ('title' in body && !toStr(body.title).trim()) {
        return reply.code(400).send({ error: 'Bad Request', message: 'العنوان مطلوب' });
      }
      const patch: NotificationEdit = {};
      if ('type' in body) patch.type = toStr(body.type).trim() as NotificationEdit['type'];
      if ('title' in body) patch.title = toStr(body.title).trim();
      if ('message' in body) patch.message = toStr(body.message);
      if ('device_id' in body) patch.device_id = toStr(body.device_id).trim() || 'all';
      if ('device_name' in body) patch.device_name = toStr(body.device_name);
      if ('customer_id' in body) patch.customer_id = body.customer_id ? toStr(body.customer_id) : null;
      if ('product_id' in body) patch.product_id = body.product_id ? toStr(body.product_id) : null;
      if ('attachment_path' in body) patch.attachment_path = body.attachment_path ? toStr(body.attachment_path) : null;
      if ('attachment_type' in body) patch.attachment_type = body.attachment_type ? toStr(body.attachment_type) : null;

      // If the statement attachment was replaced/removed, delete the old file.
      const updated = notifications.update(request.params.id, patch);
      if (
        'attachment_path' in patch &&
        existing.attachment_path &&
        existing.attachment_path !== updated?.attachment_path
      ) {
        await attachments.deleteByPath(existing.attachment_path);
      }
      return updated;
    } catch (err) {
      fastify.log.error(err, 'failed to edit notification');
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to edit notification' });
    }
  });

  // ── Delete (admin, only while status = new) ──────────────────────────────────
  fastify.delete<{ Params: IdParams }>('/notifications-api/:id', async (request, reply) => {
    try {
      const existing = notifications.get(request.params.id);
      if (!existing) return reply.code(404).send({ error: 'Not Found', message: 'Notification not found' });
      if (existing.status !== 'new') {
        return reply.code(409).send({ error: 'Conflict', message: 'لا يمكن حذف إشعار بعد قراءته — استخدم الإلغاء' });
      }
      notifications.delete(request.params.id);
      if (existing.attachment_path) await attachments.deleteByPath(existing.attachment_path);
      return reply.code(204).send();
    } catch (err) {
      fastify.log.error(err, 'failed to delete notification');
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to delete notification' });
    }
  });

  // ── Mark read (rep) ──────────────────────────────────────────────────────────
  fastify.patch<{ Params: IdParams; Body: Record<string, unknown> }>('/notifications-api/:id/read', async (request, reply) => {
    const deviceId = toStr(request.body?.device_id).trim() || 'unknown';
    try {
      const updated = notifications.markRead(request.params.id, deviceId);
      if (!updated) return reply.code(404).send({ error: 'Not Found', message: 'Notification not found' });
      return updated;
    } catch (err) {
      fastify.log.error(err, 'failed to mark read');
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to update notification' });
    }
  });

  // ── Mark completed (rep) ─────────────────────────────────────────────────────
  fastify.patch<{ Params: IdParams; Body: Record<string, unknown> }>('/notifications-api/:id/complete', async (request, reply) => {
    const deviceId = toStr(request.body?.device_id).trim() || 'unknown';
    try {
      const updated = notifications.markCompleted(request.params.id, deviceId);
      if (!updated) return reply.code(404).send({ error: 'Not Found', message: 'Notification not found' });
      return updated;
    } catch (err) {
      fastify.log.error(err, 'failed to mark completed');
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to update notification' });
    }
  });

  // ── Cancel (admin) ───────────────────────────────────────────────────────────
  fastify.patch<{ Params: IdParams }>('/notifications-api/:id/cancel', async (request, reply) => {
    try {
      const updated = notifications.cancel(request.params.id, 'manager');
      if (!updated) return reply.code(404).send({ error: 'Not Found', message: 'Notification not found' });
      return updated;
    } catch (err) {
      fastify.log.error(err, 'failed to cancel notification');
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to cancel notification' });
    }
  });
};

export default notificationsRoutes;
