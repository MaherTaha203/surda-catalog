/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * Schema for the notifications feature: the `notifications` table plus a small
 * `devices` registry. Nothing outside this feature is touched. Deleting the
 * feature = dropping these two tables and removing the `server/src/notifications/`
 * folder + the marked lines in server/src/app.ts.
 *
 * `notifications` columns:
 *   id, created_at, type, title, message,
 *   device_id, device_name,                  -- recipient (device_id 'all' = broadcast)
 *   customer_id, product_id,                 -- optional links
 *   attachment_path, attachment_type,        -- statement attachment (pdf | image)
 *   status,                                  -- new | read | completed | cancelled
 *   read_at, read_by,                        -- read tracking (read_by = reader device_id)
 *   completed_at, completed_by,              -- completion tracking
 *   cancelled_at, cancelled_by               -- cancellation tracking
 */
export const NOTIFICATIONS_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS notifications (
  id              TEXT PRIMARY KEY,
  created_at      TEXT NOT NULL,
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  message         TEXT NOT NULL DEFAULT '',
  device_id       TEXT NOT NULL DEFAULT 'all',
  device_name     TEXT NOT NULL DEFAULT '',
  customer_id     TEXT,
  product_id      TEXT,
  attachment_path TEXT,
  attachment_type TEXT,
  status          TEXT NOT NULL DEFAULT 'new',
  read_at         TEXT,
  read_by         TEXT,
  completed_at    TEXT,
  completed_by    TEXT,
  cancelled_at    TEXT,
  cancelled_by    TEXT
);
`;

/** The device registry — reps register a friendly name once; managers target it. */
export const DEVICES_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS notification_devices (
  device_id   TEXT PRIMARY KEY,
  device_name TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
`;

export const NOTIFICATIONS_INDEXES_DDL = `
CREATE INDEX IF NOT EXISTS idx_notifications_device ON notifications (device_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications (status);
`;

/**
 * Columns added after V1 shipped (V1 had: device_id, customer_id, product_id,
 * status, read_at, completed_at). `CREATE TABLE IF NOT EXISTS` never alters an
 * existing table, so init applies these with ALTER TABLE when missing.
 */
export const NOTIFICATIONS_MIGRATION_COLUMNS: { name: string; ddl: string }[] = [
  { name: 'device_name', ddl: "ALTER TABLE notifications ADD COLUMN device_name TEXT NOT NULL DEFAULT ''" },
  { name: 'attachment_path', ddl: 'ALTER TABLE notifications ADD COLUMN attachment_path TEXT' },
  { name: 'attachment_type', ddl: 'ALTER TABLE notifications ADD COLUMN attachment_type TEXT' },
  { name: 'read_by', ddl: 'ALTER TABLE notifications ADD COLUMN read_by TEXT' },
  { name: 'completed_by', ddl: 'ALTER TABLE notifications ADD COLUMN completed_by TEXT' },
  { name: 'cancelled_at', ddl: 'ALTER TABLE notifications ADD COLUMN cancelled_at TEXT' },
  { name: 'cancelled_by', ddl: 'ALTER TABLE notifications ADD COLUMN cancelled_by TEXT' },
];

/** Migrate legacy V1 status value 'done' → V2 'completed' (idempotent). */
export const NOTIFICATIONS_STATUS_MIGRATION = "UPDATE notifications SET status = 'completed' WHERE status = 'done'";

export const NOTIFICATION_TYPES = [
  'message', // رسالة
  'statement', // كشف حساب
  'product', // منتج
  'offer', // عرض خاص
  'announcement', // إعلان
] as const;

export const NOTIFICATION_STATUSES = ['new', 'read', 'completed', 'cancelled'] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];
