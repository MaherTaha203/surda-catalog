/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * In-place reader for notifications that don't navigate away — Message (spec §14,
 * rep can complete) and Announcement (spec §15, read-only). Statement uses the
 * AttachmentViewer; Product/Offer navigate to the product page.
 */
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { NotificationSourceBar } from './NotificationSourceBar';
import { TYPE_ICONS, TYPE_LABELS, TYPE_TINT, formatRelativeTime, type Notification } from './types';

interface Props {
  notification: Notification;
  onClose: () => void;
}

export function NotificationDetailOverlay({ notification, onClose }: Props) {
  const Icon = TYPE_ICONS[notification.type];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-background overflow-y-auto"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label={notification.title}
    >
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${TYPE_TINT[notification.type]}`}>
              <Icon size={18} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{TYPE_LABELS[notification.type]}</p>
              <h2 className="text-sm font-bold text-foreground truncate">{notification.title}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <NotificationSourceBar notification={notification} />

        <p className="text-xs text-muted-foreground">{formatRelativeTime(notification.created_at)}</p>

        <div className="rounded-2xl border border-border bg-card px-4 py-4">
          <p className="text-base text-foreground leading-relaxed whitespace-pre-line">
            {notification.message || 'لا يوجد نص لهذا الإشعار.'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
