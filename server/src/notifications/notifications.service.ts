/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * Data-access for the `notifications` table and the `notification_devices`
 * registry. Mirrors ProductsService (prepared-statement cache, no SQL in routes).
 */
import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import {
  NOTIFICATIONS_TABLE_DDL,
  NOTIFICATIONS_INDEXES_DDL,
  DEVICES_TABLE_DDL,
  NOTIFICATIONS_MIGRATION_COLUMNS,
  NOTIFICATIONS_STATUS_MIGRATION,
  NOTIFICATION_TYPES,
  NOTIFICATION_STATUSES,
  type NotificationType,
  type NotificationStatus,
} from './notifications.schema.ts';

export interface NotificationRow {
  id: string;
  created_at: string;
  type: NotificationType;
  title: string;
  message: string;
  device_id: string;
  device_name: string;
  customer_id: string | null;
  product_id: string | null;
  attachment_path: string | null;
  attachment_type: string | null;
  status: NotificationStatus;
  read_at: string | null;
  read_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
}

export interface NewNotification {
  type: NotificationType;
  title: string;
  message?: string;
  device_id?: string;
  device_name?: string;
  customer_id?: string | null;
  product_id?: string | null;
  attachment_path?: string | null;
  attachment_type?: string | null;
}

export interface NotificationEdit {
  type?: NotificationType;
  title?: string;
  message?: string;
  device_id?: string;
  device_name?: string;
  customer_id?: string | null;
  product_id?: string | null;
  attachment_path?: string | null;
  attachment_type?: string | null;
}

export interface DeviceRow {
  device_id: string;
  device_name: string;
  created_at: string;
  updated_at: string;
}

export class NotificationsService {
  constructor(private readonly db: DatabaseSync) {
    // Create tables (idempotent) and migrate a pre-existing V1 table in place —
    // add the V2 columns and convert the legacy 'done' status. No other table is
    // touched, so deleting this folder fully removes the feature.
    this.db.exec(NOTIFICATIONS_TABLE_DDL);
    this.db.exec(DEVICES_TABLE_DDL);
    this.db.exec(NOTIFICATIONS_INDEXES_DDL);

    const existing = new Set(
      (this.db.prepare('PRAGMA table_info(notifications)').all() as { name: string }[]).map((c) => c.name),
    );
    for (const col of NOTIFICATIONS_MIGRATION_COLUMNS) {
      if (!existing.has(col.name)) this.db.exec(col.ddl);
    }
    this.db.exec(NOTIFICATIONS_STATUS_MIGRATION);
  }

  private readonly stmtCache = new Map<string, StatementSync>();
  private prep(sql: string): StatementSync {
    let stmt = this.stmtCache.get(sql);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      this.stmtCache.set(sql, stmt);
    }
    return stmt;
  }

  // ── Notifications ───────────────────────────────────────────────────────────

  listAll(): NotificationRow[] {
    return this.prep(
      'SELECT * FROM notifications ORDER BY created_at DESC',
    ).all() as unknown as NotificationRow[];
  }

  /**
   * A device's feed: notifications targeted at it or broadcast, minus cancelled
   * ones it never opened (spec §4 — cancelled disappears from reps who hadn't
   * opened it, but stays visible/cancelled for the reader who had).
   */
  listForDevice(deviceId: string): NotificationRow[] {
    return this.prep(
      `SELECT * FROM notifications
        WHERE (device_id = ? OR device_id = 'all')
          AND NOT (status = 'cancelled' AND (read_by IS NULL OR read_by <> ?))
        ORDER BY created_at DESC`,
    ).all(deviceId, deviceId) as unknown as NotificationRow[];
  }

  get(id: string): NotificationRow | undefined {
    return this.prep('SELECT * FROM notifications WHERE id = ?').get(id) as
      | unknown as NotificationRow | undefined;
  }

  create(input: NewNotification): NotificationRow {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.prep(
      `INSERT INTO notifications
        (id, created_at, type, title, message, device_id, device_name,
         customer_id, product_id, attachment_path, attachment_type, status,
         read_at, read_by, completed_at, completed_by, cancelled_at, cancelled_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', NULL, NULL, NULL, NULL, NULL, NULL)`,
    ).run(
      id,
      now,
      input.type,
      input.title,
      input.message ?? '',
      input.device_id?.trim() || 'all',
      input.device_name ?? '',
      input.customer_id ?? null,
      input.product_id ?? null,
      input.attachment_path ?? null,
      input.attachment_type ?? null,
    );
    return this.get(id) as NotificationRow;
  }

  /** Edit a notification (allowed only while status = 'new'; enforced in the route). */
  update(id: string, patch: NotificationEdit): NotificationRow | undefined {
    const row = this.get(id);
    if (!row) return undefined;
    const merged = {
      type: patch.type ?? row.type,
      title: patch.title ?? row.title,
      message: patch.message ?? row.message,
      device_id: patch.device_id ?? row.device_id,
      device_name: patch.device_name ?? row.device_name,
      customer_id: patch.customer_id === undefined ? row.customer_id : patch.customer_id,
      product_id: patch.product_id === undefined ? row.product_id : patch.product_id,
      attachment_path: patch.attachment_path === undefined ? row.attachment_path : patch.attachment_path,
      attachment_type: patch.attachment_type === undefined ? row.attachment_type : patch.attachment_type,
    };
    this.prep(
      `UPDATE notifications SET
         type = ?, title = ?, message = ?, device_id = ?, device_name = ?,
         customer_id = ?, product_id = ?, attachment_path = ?, attachment_type = ?
       WHERE id = ?`,
    ).run(
      merged.type,
      merged.title,
      merged.message,
      merged.device_id,
      merged.device_name,
      merged.customer_id,
      merged.product_id,
      merged.attachment_path,
      merged.attachment_type,
      id,
    );
    return this.get(id);
  }

  delete(id: string): NotificationRow | undefined {
    const row = this.get(id);
    if (!row) return undefined;
    this.prep('DELETE FROM notifications WHERE id = ?').run(id);
    return row;
  }

  /** Mark read by a device (idempotent; never downgrades completed/cancelled). */
  markRead(id: string, deviceId: string): NotificationRow | undefined {
    const row = this.get(id);
    if (!row) return undefined;
    if (row.status === 'new') {
      this.prep(
        "UPDATE notifications SET status = 'read', read_at = ?, read_by = ? WHERE id = ?",
      ).run(new Date().toISOString(), deviceId, id);
    }
    return this.get(id);
  }

  /** Mark completed by a device. Stamps read_at/read_by if still unread. */
  markCompleted(id: string, deviceId: string): NotificationRow | undefined {
    const row = this.get(id);
    if (!row) return undefined;
    if (row.status === 'cancelled') return row; // cancelled can't be completed
    const now = new Date().toISOString();
    this.prep(
      `UPDATE notifications SET
         status = 'completed',
         read_at = COALESCE(read_at, ?), read_by = COALESCE(read_by, ?),
         completed_at = ?, completed_by = ?
       WHERE id = ?`,
    ).run(now, deviceId, now, deviceId, id);
    return this.get(id);
  }

  /** Cancel a notification (spec §4). `by` is a marker string (e.g. 'manager'). */
  cancel(id: string, by: string): NotificationRow | undefined {
    const row = this.get(id);
    if (!row) return undefined;
    this.prep(
      "UPDATE notifications SET status = 'cancelled', cancelled_at = ?, cancelled_by = ? WHERE id = ?",
    ).run(new Date().toISOString(), by, id);
    return this.get(id);
  }

  // ── Device registry ─────────────────────────────────────────────────────────

  listDevices(): DeviceRow[] {
    return this.prep(
      'SELECT * FROM notification_devices ORDER BY device_name COLLATE NOCASE ASC',
    ).all() as unknown as DeviceRow[];
  }

  /** Register or rename a device (upsert on device_id). */
  registerDevice(deviceId: string, deviceName: string): DeviceRow {
    const now = new Date().toISOString();
    this.prep(
      `INSERT INTO notification_devices (device_id, device_name, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET device_name = excluded.device_name, updated_at = excluded.updated_at`,
    ).run(deviceId, deviceName, now, now);
    return this.prep('SELECT * FROM notification_devices WHERE device_id = ?').get(deviceId) as
      | unknown as DeviceRow;
  }

  // ── Validators ──────────────────────────────────────────────────────────────

  static isValidType(v: unknown): v is NotificationType {
    return NOTIFICATION_TYPES.includes(v as NotificationType);
  }

  static isValidStatus(v: unknown): v is NotificationStatus {
    return NOTIFICATION_STATUSES.includes(v as NotificationStatus);
  }
}
