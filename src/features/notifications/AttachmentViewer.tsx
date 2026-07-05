/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * Full-screen viewer for a Statement notification's single attachment (spec §1,
 * §12). PDFs render in an inline <iframe> (the browser's built-in PDF viewer);
 * images render contained. Everything opens in-app — no download required.
 * The completion bar sits on top.
 */
import { motion } from 'framer-motion';
import { X, FileText } from 'lucide-react';
import { resolveImageUrl } from '@/api/client';
import { NotificationSourceBar } from './NotificationSourceBar';
import { TYPE_LABELS, formatRelativeTime, type Notification } from './types';

interface Props {
  notification: Notification;
  onClose: () => void;
}

export function AttachmentViewer({ notification, onClose }: Props) {
  const url = notification.attachment_path ? resolveImageUrl(notification.attachment_path) : '';
  const isPdf = notification.attachment_type === 'pdf';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-background flex flex-col"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label={notification.title}
    >
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
              <FileText size={18} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {TYPE_LABELS[notification.type]} · {formatRelativeTime(notification.created_at)}
              </p>
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
        <div className="max-w-4xl mx-auto px-4 pb-3">
          <NotificationSourceBar notification={notification} />
        </div>
      </div>

      {/* Attachment body */}
      <div className="flex-1 min-h-0 bg-muted/40">
        {!url ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            لا يوجد مرفق
          </div>
        ) : isPdf ? (
          <iframe title={notification.title} src={url} className="w-full h-full border-0" />
        ) : (
          <div className="h-full overflow-auto flex items-start justify-center p-4">
            <img src={url} alt={notification.title} className="max-w-full h-auto rounded-lg shadow-md" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
