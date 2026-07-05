/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * The bar shown at the top of a target (product page / attachment / message
 * reader) when opened from a notification. Reps press "تم التنفيذ" to complete
 * (spec §7, §14) — except announcements, which are read-only (spec §15).
 * Cancelled notifications show a "ملغى" note instead.
 */
import { useState } from 'react';
import { BellRing, Check, CheckCheck, Ban } from 'lucide-react';
import { useMarkCompleted, useNotification } from './hooks';
import { getDeviceId } from './device';
import { requiresCompletion, type Notification } from './types';

interface Props {
  /** Pass the id (product page) — the bar fetches the notification itself. */
  notifId?: string;
  /** Or pass the full notification (overlays already have it). */
  notification?: Notification;
  onCompleted?: () => void;
}

export function NotificationSourceBar({ notifId, notification, onCompleted }: Props) {
  const { data: fetched } = useNotification(notification ? undefined : notifId);
  const notif = notification ?? fetched ?? undefined;
  const markCompleted = useMarkCompleted();
  // Local flag so the bar flips to "completed" instantly even when it was handed
  // a static notification object (the cache updates, but the prop doesn't).
  const [justCompleted, setJustCompleted] = useState(false);

  if (!notif) return null;

  const id = notif.id;
  const isCancelled = notif.status === 'cancelled';
  const isCompleted = notif.status === 'completed' || justCompleted;
  const canComplete = requiresCompletion(notif.type) && !isCompleted && !isCancelled;

  const handleComplete = () => {
    markCompleted.mutate(
      { id, deviceId: getDeviceId() },
      { onSuccess: () => { setJustCompleted(true); onCompleted?.(); } },
    );
  };

  return (
    <div
      dir="rtl"
      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-sm ${
        isCancelled ? 'border-gray-300 bg-gray-100' : 'border-primary/20 bg-primary/5'
      }`}
    >
      <span className={`flex items-center gap-2 min-w-0 ${isCancelled ? 'text-gray-600' : 'text-primary'}`}>
        {isCancelled ? <Ban size={16} aria-hidden className="shrink-0" /> : <BellRing size={16} aria-hidden className="shrink-0" />}
        <span className="truncate">
          {isCancelled ? 'تم إلغاء هذا الإشعار' : 'تم فتح هذه الصفحة من إشعار'}
        </span>
      </span>

      {isCompleted ? (
        <span className="flex items-center gap-1 shrink-0 text-green-600 font-medium">
          <CheckCheck size={16} aria-hidden />
          تم التنفيذ
        </span>
      ) : canComplete ? (
        <button
          type="button"
          onClick={handleComplete}
          disabled={markCompleted.isPending}
          className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          <Check size={14} aria-hidden />
          تم التنفيذ
        </button>
      ) : null}
    </div>
  );
}
