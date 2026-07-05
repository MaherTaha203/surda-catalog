/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible).
 *
 * Data-access for the `notifications` table. Mirrors the style of
 * ProductsService (prepared-statement cache, no SQL in the route layer).
 */
import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import {
  NOTIFICATIONS_TABLE_DDL,
  NOTIFICATIONS_INDEXES_DDL,
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
  customer_id: string | null;
  product_id: string | null;
  status: NotificationStatus;
  read_at: string | null;
  completed_at: string | null;
}

export interface NewNotification {
  type: NotificationType;
  title: string;
  message?: string;
  device_id?: string;
  customer_id?: string | null;
  product_id?: string | null;
}

export class NotificationsService {
  constructor(private readonly db: DatabaseSync) {
    // Create the (single new) table on first use — no other table is touched,
    // and this keeps the feature self-contained (server/src/database/* is not
    // modified, so deleting this folder fully removes the feature).
    this.db.exec(NOTIFICATIONS_TABLE_DDL);
    this.db.exec(NOTIFICATIONS_INDEXES_DDL);
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

  /** Every notification, newest first (manager view). */
  listAll(): NotificationRow[] {
    return this.prep(
      'SELECT * FROM notifications ORDER BY created_at DESC',
    ).all() as unknown as NotificationRow[];
  }

  /**
   * Notifications addressed to one delegate device: either targeted at that
   * exact device_id or broadcast ('all'). Newest first.
   */
  listForDevice(deviceId: string): NotificationRow[] {
    return this.prep(
      "SELECT * FROM notifications WHERE device_id = ? OR device_id = 'all' ORDER BY created_at DESC",
    ).all(deviceId) as unknown as NotificationRow[];
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
        (id, created_at, type, title, message, device_id, customer_id, product_id, status, read_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', NULL, NULL)`,
    ).run(
      id,
      now,
      input.type,
      input.title,
      input.message ?? '',
      input.device_id?.trim() || 'all',
      input.customer_id ?? null,
      input.product_id ?? null,
    );
    return this.get(id) as NotificationRow;
  }

  /** Mark as read (idempotent; never downgrades a 'done' notification). */
  markRead(id: string): NotificationRow | undefined {
    const row = this.get(id);
    if (!row) return undefined;
    if (row.status === 'new') {
      const now = new Date().toISOString();
      this.prep(
        "UPDATE notifications SET status = 'read', read_at = ? WHERE id = ?",
      ).run(now, id);
    }
    return this.get(id);
  }

  /** Mark as executed/done. Also stamps read_at if it was still unread. */
  markDone(id: string): NotificationRow | undefined {
    const row = this.get(id);
    if (!row) return undefined;
    const now = new Date().toISOString();
    this.prep(
      "UPDATE notifications SET status = 'done', read_at = COALESCE(read_at, ?), completed_at = ? WHERE id = ?",
    ).run(now, now, id);
    return this.get(id);
  }

  static isValidType(v: unknown): v is NotificationType {
    return NOTIFICATION_TYPES.includes(v as NotificationType);
  }

  static isValidStatus(v: unknown): v is NotificationStatus {
    return NOTIFICATION_STATUSES.includes(v as NotificationStatus);
  }
}
