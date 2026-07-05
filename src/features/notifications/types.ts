/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible).
 *
 * Shared types + Arabic labels + icon mapping for the notifications feature.
 * Everything the feature needs lives under src/features/notifications/ so the
 * whole thing can be deleted in one folder (see README.md).
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

export const NOTIFICATION_STATUSES = ['new', 'read', 'done'] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

/** Server row shape (snake_case, straight from the notifications table). */
export interface Notification {
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
  done: 'تم التنفيذ',
};

export const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  message: MessageSquare,
  statement: Receipt,
  product: Package,
  offer: BadgePercent,
  announcement: Megaphone,
};

/** Tailwind tint per type — kept subtle so it never fights the catalog theme. */
export const TYPE_TINT: Record<NotificationType, string> = {
  message: 'bg-sky-100 text-sky-700',
  statement: 'bg-emerald-100 text-emerald-700',
  product: 'bg-amber-100 text-amber-700',
  offer: 'bg-rose-100 text-rose-700',
  announcement: 'bg-violet-100 text-violet-700',
};

/** Badge styling per status, for the manager list. */
export const STATUS_TINT: Record<NotificationStatus, string> = {
  new: 'bg-red-100 text-red-700',
  read: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
};

/** Short, RTL-friendly relative time ("قبل ٣ د", "قبل ساعتين", …). */
export function formatRelativeTime(iso: string): string {
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
