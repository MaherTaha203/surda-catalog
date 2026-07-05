/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible).
 *
 * Schema for the single new table this feature adds: `notifications`.
 * Nothing else in the database is touched. Deleting this feature = dropping
 * this table and removing the `server/src/notifications/` folder + the two
 * marked lines in server/src/app.ts.
 *
 * Fields (exactly the ones the spec asks for):
 *   id, created_at, type, title, message, device_id,
 *   customer_id (nullable), product_id (nullable), status, read_at, completed_at
 */
export const NOTIFICATIONS_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT PRIMARY KEY,
  created_at   TEXT NOT NULL,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  message      TEXT NOT NULL DEFAULT '',
  device_id    TEXT NOT NULL DEFAULT 'all',
  customer_id  TEXT,
  product_id   TEXT,
  status       TEXT NOT NULL DEFAULT 'new',
  read_at      TEXT,
  completed_at TEXT
);
`;

/** Index the two columns the delegate polling query filters/sorts on. */
export const NOTIFICATIONS_INDEXES_DDL = `
CREATE INDEX IF NOT EXISTS idx_notifications_device ON notifications (device_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at);
`;

/** The five allowed notification types (spec: أنواع الإشعار). */
export const NOTIFICATION_TYPES = [
  'message', // رسالة
  'statement', // كشف حساب
  'product', // منتج
  'offer', // عرض خاص
  'announcement', // إعلان
] as const;

/** The three lifecycle statuses (spec: جديد / تمت القراءة / تم التنفيذ). */
export const NOTIFICATION_STATUSES = ['new', 'read', 'done'] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];
