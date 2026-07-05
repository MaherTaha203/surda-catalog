/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * Delegate entry point: a small bell + red unread badge in the catalog header.
 * Tapping opens a SIDE PANEL (spec §9) listing this device's notifications with
 * icon, title, short description, time, and status badge. Opening one:
 *   - product / offer → product page (offer shows offer info there)
 *   - statement        → attachment viewer (PDF / image)
 *   - message / announcement → in-place reader
 * Opening flips it to "read"; message/statement/product/offer can then be
 * completed (announcements are read-only). Polls every 30s.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, X, ChevronLeft, Settings } from 'lucide-react';
import { useDeviceNotifications, useMarkRead } from './hooks';
import { NotificationDetailOverlay } from './NotificationDetailOverlay';
import { AttachmentViewer } from './AttachmentViewer';
import { DeviceRegistration } from './DeviceRegistration';
import { getDeviceId, getDeviceName } from './device';
import {
  TYPE_ICONS,
  TYPE_LABELS,
  TYPE_TINT,
  STATUS_LABELS,
  STATUS_TINT,
  formatRelativeTime,
  type Notification,
} from './types';

/** One-line description for the panel row. */
function shortDescription(n: Notification): string {
  if (n.type === 'statement') return n.attachment_type === 'pdf' ? 'مرفق PDF' : 'مرفق صورة';
  if (n.message) return n.message;
  return TYPE_LABELS[n.type];
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { data: notifications = [] } = useDeviceNotifications();
  const markRead = useMarkRead();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Notification | null>(null);
  const [attachment, setAttachment] = useState<Notification | null>(null);
  const [deviceDialog, setDeviceDialog] = useState(false);

  const unreadCount = notifications.filter((n) => n.status === 'new').length;

  const openPanel = () => {
    // First use: make the rep name this device so targeting + read tracking work.
    if (!getDeviceName()) setDeviceDialog(true);
    setOpen(true);
  };

  const handleOpenNotification = (n: Notification) => {
    if (n.status === 'new') markRead.mutate({ id: n.id, deviceId: getDeviceId() });
    setOpen(false);

    if ((n.type === 'product' || n.type === 'offer') && n.product_id) {
      navigate({ to: '/product/$id', params: { id: n.product_id }, search: { notif: n.id } });
      return;
    }
    if (n.type === 'statement') {
      setAttachment(n);
      return;
    }
    setDetail(n);
  };

  const bell = (
    <button
      type="button"
      onClick={openPanel}
      aria-label={unreadCount > 0 ? `الإشعارات (${unreadCount} جديد)` : 'الإشعارات'}
      className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      <Bell size={18} />
      {unreadCount > 0 && (
        <span
          className="absolute -top-0.5 -left-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none"
          aria-hidden
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  return (
    <>
      {bell}
      {portalTarget &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                key="notif-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-foreground/40"
                onClick={() => setOpen(false)}
                dir="rtl"
              >
                <motion.aside
                  key="notif-panel"
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
                  className="absolute inset-y-0 right-0 w-full max-w-sm bg-background shadow-2xl flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-label="الإشعارات"
                >
                  <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Bell size={18} className="text-primary" aria-hidden />
                      <h2 className="text-base font-bold text-foreground">الإشعارات</h2>
                      {unreadCount > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setDeviceDialog(true)}
                        aria-label="اسم الجهاز"
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Settings size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        aria-label="إغلاق"
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6">
                        <Bell size={40} className="text-muted-foreground/30 mb-3" strokeWidth={1} aria-hidden />
                        <p className="text-sm text-muted-foreground">لا توجد إشعارات</p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-border">
                        {notifications.map((n) => {
                          const Icon = TYPE_ICONS[n.type];
                          const isNew = n.status === 'new';
                          return (
                            <li key={n.id}>
                              <button
                                type="button"
                                onClick={() => handleOpenNotification(n)}
                                className={`w-full text-right flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors ${
                                  isNew ? 'bg-primary/[0.03]' : ''
                                }`}
                              >
                                <span className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${TYPE_TINT[n.type]}`}>
                                  <Icon size={18} aria-hidden />
                                </span>
                                <span className="flex-1 min-w-0">
                                  <span className="flex items-center gap-2">
                                    {isNew && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" aria-hidden />}
                                    <span className="font-bold text-sm text-foreground truncate">{n.title}</span>
                                  </span>
                                  <span className="block mt-0.5 text-xs text-muted-foreground truncate">
                                    {shortDescription(n)}
                                  </span>
                                  <span className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <span>{TYPE_LABELS[n.type]}</span>
                                    <span aria-hidden>·</span>
                                    <span>{formatRelativeTime(n.created_at)}</span>
                                    <span className={`px-1.5 py-0.5 rounded-full font-medium ${STATUS_TINT[n.status]}`}>
                                      {STATUS_LABELS[n.status]}
                                    </span>
                                  </span>
                                </span>
                                <ChevronLeft size={16} className="text-muted-foreground/50 shrink-0 mt-1" aria-hidden />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </motion.aside>
              </motion.div>
            )}
          </AnimatePresence>,
          portalTarget,
        )}

      {portalTarget &&
        createPortal(
          <AnimatePresence>
            {detail && (
              <NotificationDetailOverlay key={detail.id} notification={detail} onClose={() => setDetail(null)} />
            )}
            {attachment && (
              <AttachmentViewer key={attachment.id} notification={attachment} onClose={() => setAttachment(null)} />
            )}
          </AnimatePresence>,
          portalTarget,
        )}

      <DeviceRegistration
        open={deviceDialog}
        requireName={!getDeviceName()}
        onClose={() => setDeviceDialog(false)}
      />
    </>
  );
}
