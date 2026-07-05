/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * Shared types + Arabic labels + icon/colour maps. Everything the feature needs
 * lives under src/features/notifications/, so it deletes as one folder.
 */
import { MessageSquare, Receipt, Package, BadgePercent, Megaphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const NOTIFICATION_TYPES = [
  'message',
  'statement',
  'product',
  'offer',
  'announcement',
] as const;

export const NOTIFICATION_STATUSES = ['new', 'read', 'completed', 'cancelled'] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];
export type AttachmentType = 'pdf' | 'image';

/** Server row shape (snake_case, straight from the notifications table). */
export interface Notification {
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
  attachment_type: AttachmentType | null;
  status: NotificationStatus;
  read_at: string | null;
  read_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
}

export interface Device {
  device_id: string;
  device_name: string;
  created_at: string;
  updated_at: string;
}

/** Retention window (days) before completed/cancelled rows auto-delete. 0 = off. */
export interface NotificationSettings {
  completed_retention_days: number;
  cancelled_retention_days: number;
  updated_at: string;
}

export const TYPE_LABELS: Record<NotificationType, string> = {
  message: 'رسالة',
  statement: 'كشف حساب',
  product: 'منتج',
  offer: 'عرض خاص',
  announcement: 'إعلان',
};

export const STATUS_LABELS: Record<NotificationStatus, string> = {
  new: 'جديد',
  read: 'تمت القراءة',
  completed: 'تم التنفيذ',
  cancelled: 'ملغى',
};

export const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  message: MessageSquare,
  statement: Receipt,
  product: Package,
  offer: BadgePercent,
  announcement: Megaphone,
};

/** Subtle tint per type — never fights the catalog theme. */
export const TYPE_TINT: Record<NotificationType, string> = {
  message: 'bg-sky-100 text-sky-700',
  statement: 'bg-emerald-100 text-emerald-700',
  product: 'bg-amber-100 text-amber-700',
  offer: 'bg-rose-100 text-rose-700',
  announcement: 'bg-violet-100 text-violet-700',
};

/** Coloured status badge (spec §5). */
export const STATUS_TINT: Record<NotificationStatus, string> = {
  new: 'bg-red-100 text-red-700',
  read: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-200 text-gray-600',
};

/** Broadcast recipient marker. */
export const ALL_DEVICES = 'all';
export const ALL_DEVICES_LABEL = 'كل الأجهزة';

/** Announcements are read-only (spec §15) — no "completed" action. */
export function requiresCompletion(type: NotificationType): boolean {
  return type !== 'announcement';
}

/** Short, RTL-friendly relative time. */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return 'الآن';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `قبل ${diffMin} د`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `قبل ${diffHour} س`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return `قبل ${diffDay} يوم`;
  return new Date(iso).toLocaleDateString('ar');
}

/** Absolute date+time for manager tracking columns ("Today 10:45 AM" style). */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  const date = d.toLocaleDateString('ar', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}
