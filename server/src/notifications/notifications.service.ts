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
  NOTIFICATION_SETTINGS_TABLE_DDL,
  NOTIFICATIONS_MIGRATION_COLUMNS,
  NOTIFICATIONS_STATUS_MIGRATION,
  NOTIFICATION_TYPES,
  NOTIFICATION_STATUSES,
  DEFAULT_COMPLETED_RETENTION_DAYS,
  DEFAULT_CANCELLED_RETENTION_DAYS,
  MAX_RETENTION_DAYS,
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

export interface NotificationSettings {
  completed_retention_days: number;
  cancelled_retention_days: number;
  updated_at: string;
}

export class NotificationsService {
  constructor(private readonly db: DatabaseSync) {
    // Create tables (idempotent) and migrate a pre-existing V1 table in place —
    // add the V2 columns and convert the legacy 'done' status. No other table is
    // touched, so deleting this folder fully removes the feature.
    this.db.exec(NOTIFICATIONS_TABLE_DDL);
    this.db.exec(DEVICES_TABLE_DDL);
    this.db.exec(NOTIFICATION_SETTINGS_TABLE_DDL);
    this.db.exec(NOTIFICATIONS_INDEXES_DDL);

    const existing = new Set(
      (this.db.prepare('PRAGMA table_info(notifications)').all() as { name: string }[]).map((c) => c.name),
    );
    for (const col of NOTIFICATIONS_MIGRATION_COLUMNS) {
      if (!existing.has(col.name)) this.db.exec(col.ddl);
    }
    this.db.exec(NOTIFICATIONS_STATUS_MIGRATION);

    // Seed the single settings row (id = 1) with defaults if it doesn't exist.
    this.db
      .prepare(
        `INSERT INTO notification_settings (id, completed_retention_days, cancelled_retention_days, updated_at)
         VALUES (1, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
      )
      .run(DEFAULT_COMPLETED_RETENTION_DAYS, DEFAULT_CANCELLED_RETENTION_DAYS, new Date().toISOString());
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

  /** Edit a notification (allowed while status = 'new' or 'read'; enforced in the route). */
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

  // ── Bulk maintenance (manager tools + auto-expiry) ───────────────────────────

  /**
   * Delete every notification whose status is in `statuses` and return the
   * deleted rows so the route can unlink their attachment files. Optionally
   * limited to rows whose relevant timestamp is older than `before` (ISO) — used
   * by the retention sweep. The two are combined with the state list per-status.
   */
  private deleteByStatuses(statuses: NotificationStatus[]): NotificationRow[] {
    if (statuses.length === 0) return [];
    const placeholders = statuses.map(() => '?').join(', ');
    const rows = this.prep(
      `SELECT * FROM notifications WHERE status IN (${placeholders})`,
    ).all(...statuses) as unknown as NotificationRow[];
    this.prep(`DELETE FROM notifications WHERE status IN (${placeholders})`).run(...statuses);
    return rows;
  }

  /** Delete all completed notifications (manager tool). Returns deleted rows. */
  deleteCompleted(): NotificationRow[] {
    return this.deleteByStatuses(['completed']);
  }

  /** Delete all cancelled notifications (manager tool). Returns deleted rows. */
  deleteCancelled(): NotificationRow[] {
    return this.deleteByStatuses(['cancelled']);
  }

  /**
   * Clean the notification center: delete everything except brand-new
   * (unread) notifications (manager tool). Returns deleted rows.
   */
  cleanupExceptNew(): NotificationRow[] {
    return this.deleteByStatuses(['read', 'completed', 'cancelled']);
  }

  /**
   * Retention sweep (spec §3/§4): delete completed rows older than
   * `completedDays` and cancelled rows older than `cancelledDays`. A day count
   * of 0 disables sweeping that state. Returns the deleted rows so the route can
   * unlink their attachments. Uses completed_at / cancelled_at as the clock.
   */
  sweepExpired(completedDays: number, cancelledDays: number): NotificationRow[] {
    const deleted: NotificationRow[] = [];
    const now = Date.now();
    const runOne = (status: NotificationStatus, stampCol: string, days: number) => {
      if (!Number.isFinite(days) || days <= 0) return;
      const cutoff = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
      const rows = this.prep(
        `SELECT * FROM notifications
          WHERE status = ? AND COALESCE(${stampCol}, created_at) < ?`,
      ).all(status, cutoff) as unknown as NotificationRow[];
      if (rows.length === 0) return;
      this.prep(
        `DELETE FROM notifications
          WHERE status = ? AND COALESCE(${stampCol}, created_at) < ?`,
      ).run(status, cutoff);
      deleted.push(...rows);
    };
    runOne('completed', 'completed_at', completedDays);
    runOne('cancelled', 'cancelled_at', cancelledDays);
    return deleted;
  }

  // ── Settings ─────────────────────────────────────────────────────────────────

  getSettings(): NotificationSettings {
    const row = this.prep(
      'SELECT completed_retention_days, cancelled_retention_days, updated_at FROM notification_settings WHERE id = 1',
    ).get() as unknown as NotificationSettings | undefined;
    return (
      row ?? {
        completed_retention_days: DEFAULT_COMPLETED_RETENTION_DAYS,
        cancelled_retention_days: DEFAULT_CANCELLED_RETENTION_DAYS,
        updated_at: new Date().toISOString(),
      }
    );
  }

  updateSettings(patch: { completed_retention_days?: number; cancelled_retention_days?: number }): NotificationSettings {
    const current = this.getSettings();
    const clamp = (v: number | undefined, fallback: number) => {
      if (v === undefined || !Number.isFinite(v)) return fallback;
      return Math.max(0, Math.min(MAX_RETENTION_DAYS, Math.round(v)));
    };
    const completed = clamp(patch.completed_retention_days, current.completed_retention_days);
    const cancelled = clamp(patch.cancelled_retention_days, current.cancelled_retention_days);
    this.prep(
      `UPDATE notification_settings
         SET completed_retention_days = ?, cancelled_retention_days = ?, updated_at = ?
       WHERE id = 1`,
    ).run(completed, cancelled, new Date().toISOString());
    return this.getSettings();
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
