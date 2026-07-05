/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible).
 *
 * The small bar shown at the top of a target (product page / statement / message
 * overlay) when it was opened from a notification:
 *
 *   "تم فتح هذه الصفحة من إشعار"   [ تم التنفيذ ]
 *
 * Pressing "تم التنفيذ" flips the notification's status to done.
 */
import { useState } from 'react';
import { BellRing, Check, CheckCheck } from 'lucide-react';
import { useMarkDone } from './hooks';

interface Props {
  notifId: string;
  /** Whether the notification is already marked done (hides the action). */
  alreadyDone?: boolean;
  onDone?: () => void;
}

export function NotificationSourceBar({ notifId, alreadyDone = false, onDone }: Props) {
  const markDone = useMarkDone();
  const [done, setDone] = useState(alreadyDone);

  const handleDone = () => {
    markDone.mutate(notifId, {
      onSuccess: () => {
        setDone(true);
        onDone?.();
      },
    });
  };

  return (
    <div
      dir="rtl"
      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-primary/20 bg-primary/5 text-sm"
    >
      <span className="flex items-center gap-2 text-primary min-w-0">
        <BellRing size={16} aria-hidden className="shrink-0" />
        <span className="truncate">تم فتح هذه الصفحة من إشعار</span>
      </span>
      {done ? (
        <span className="flex items-center gap-1 shrink-0 text-green-600 font-medium">
          <CheckCheck size={16} aria-hidden />
          تم التنفيذ
        </span>
      ) : (
        <button
          type="button"
          onClick={handleDone}
          disabled={markDone.isPending}
          className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          <Check size={14} aria-hidden />
          تم التنفيذ
        </button>
      )}
    </div>
  );
}
