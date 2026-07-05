/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible).
 *
 * Manager's notifications screen (reached from the new "الإشعارات" button in the
 * admin panel). Left/top: create form. Below: every notification with its live
 * status (جديد / تمت القراءة / تم التنفيذ), polled every 30s.
 *
 * PIN-gated exactly like the existing admin page — no auth code is duplicated;
 * it reuses the same storage helpers.
 */
import { useEffect } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { ArrowRight, Bell } from 'lucide-react';
import { isAdminUnlocked, isPinUnlocked } from '@/lib/storage';
import { useIsClient } from '@/hooks/useIsClient';
import { AdminNotificationForm } from './AdminNotificationForm';
import { useAllNotifications } from './hooks';
import {
  TYPE_ICONS,
  TYPE_LABELS,
  TYPE_TINT,
  STATUS_LABELS,
  STATUS_TINT,
  formatRelativeTime,
} from './types';

export function AdminNotificationsPage() {
  const navigate = useNavigate();
  const isClient = useIsClient();
  const unlocked = isClient && isPinUnlocked() && isAdminUnlocked();

  useEffect(() => {
    if (isClient && !unlocked) navigate({ to: '/', replace: true });
  }, [unlocked, navigate, isClient]);

  const { data: notifications = [], isLoading, refetch } = useAllNotifications(unlocked);

  if (!unlocked) return null;

  return (
    <div className="min-h-dvh bg-background" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <Link
              to="/admin"
              aria-label="لوحة التحكم"
              className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowRight size={18} aria-hidden />
              <span className="hidden sm:inline">لوحة التحكم</span>
            </Link>
            <h1 className="flex items-center gap-2 text-base sm:text-lg font-bold text-foreground whitespace-nowrap">
              <Bell size={18} className="text-primary" aria-hidden />
              الإشعارات
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-5">
        <AdminNotificationForm onCreated={() => refetch()} />

        {/* Sent notifications + statuses */}
        <section>
          <h2 className="text-sm font-bold text-foreground mb-2">الإشعارات المُرسلة</h2>
          {isLoading ? (
            <div className="space-y-2 animate-pulse" role="status" aria-label="جارٍ التحميل">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-muted" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell size={40} className="text-muted-foreground/30 mb-3" strokeWidth={1} aria-hidden />
              <p className="text-sm text-muted-foreground">لم يتم إرسال أي إشعار بعد</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type];
                return (
                  <li
                    key={n.id}
                    className="flex items-start gap-3 px-3 py-3 rounded-xl border border-border bg-card"
                  >
                    <span className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${TYPE_TINT[n.type]}`}>
                      <Icon size={18} aria-hidden />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm text-foreground truncate">{n.title}</p>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_TINT[n.status]}`}>
                          {STATUS_LABELS[n.status]}
                        </span>
                      </div>
                      {n.message && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span>{TYPE_LABELS[n.type]}</span>
                        <span aria-hidden>·</span>
                        <span>إلى: <span className="font-mono" dir="ltr">{n.device_id}</span></span>
                        <span aria-hidden>·</span>
                        <span>{formatRelativeTime(n.created_at)}</span>
                        {n.customer_id && (
                          <>
                            <span aria-hidden>·</span>
                            <span>العميل: {n.customer_id}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
