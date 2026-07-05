/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * Manager dashboard (spec §20). Create / edit a notification, then see every
 * notification with live status and read/completion tracking, filtered by status.
 * A link opens the full history page (spec §8). PIN-gated like the admin panel.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearch, Link } from '@tanstack/react-router';
import { ArrowRight, Bell, History } from 'lucide-react';
import { isAdminUnlocked, isPinUnlocked } from '@/lib/storage';
import { useIsClient } from '@/hooks/useIsClient';
import { AdminNotificationForm } from './AdminNotificationForm';
import { ManagerNotificationList } from './ManagerNotificationList';
import { NotificationMaintenance } from './NotificationMaintenance';
import { useAllNotifications, useDevices } from './hooks';
import { makeDeviceNameResolver, filterNotifications } from './filters';
import { NOTIFICATION_STATUSES, STATUS_LABELS, type Notification, type NotificationStatus } from './types';

const STATUS_FILTERS: ('all' | NotificationStatus)[] = ['all', ...NOTIFICATION_STATUSES];

export function AdminNotificationsPage() {
  const navigate = useNavigate();
  const isClient = useIsClient();
  const unlocked = isClient && isPinUnlocked() && isAdminUnlocked();

  useEffect(() => {
    if (isClient && !unlocked) navigate({ to: '/', replace: true });
  }, [unlocked, navigate, isClient]);

  const { data: notifications = [], isLoading } = useAllNotifications(unlocked);
  const { data: devices = [] } = useDevices(unlocked);
  const deviceName = useMemo(() => makeDeviceNameResolver(devices), [devices]);

  const [editing, setEditing] = useState<Notification | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | NotificationStatus>('all');
  const formRef = useRef<HTMLDivElement>(null);

  // Deep-link from the history page (?edit=<id>) enters edit mode once loaded.
  const { edit: editId } = useSearch({ strict: false }) as { edit?: string };
  useEffect(() => {
    if (!editId || editing) return;
    const target = notifications.find(
      (n) => n.id === editId && (n.status === 'new' || n.status === 'read'),
    );
    if (target) setEditing(target);
  }, [editId, notifications, editing]);

  const filtered = useMemo(
    () => filterNotifications(notifications, { status: statusFilter }, deviceName),
    [notifications, statusFilter, deviceName],
  );

  const startEdit = (n: Notification) => {
    setEditing(n);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!unlocked) return null;

  return (
    <div className="min-h-dvh bg-background" dir="rtl">
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
          <Link
            to="/notifications-history"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/70 transition-colors"
          >
            <History size={16} aria-hidden />
            <span className="hidden sm:inline">السجل</span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-5">
        <div ref={formRef}>
          <AdminNotificationForm
            editing={editing}
            onDone={() => setEditing(null)}
            onCancelEdit={() => setEditing(null)}
          />
        </div>

        <NotificationMaintenance
          enabled={unlocked}
          completedCount={notifications.filter((n) => n.status === 'completed').length}
          cancelledCount={notifications.filter((n) => n.status === 'cancelled').length}
          cleanableCount={notifications.filter((n) => n.status !== 'new').length}
        />

        <section>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-bold text-foreground">الإشعارات المُرسلة</h2>
          </div>

          {/* Status filter chips */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-2">
            {STATUS_FILTERS.map((s) => {
              const count = s === 'all' ? notifications.length : notifications.filter((n) => n.status === s).length;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/70'
                  }`}
                >
                  {s === 'all' ? 'الكل' : STATUS_LABELS[s]}
                  <span className={`px-1.5 rounded-full ${statusFilter === s ? 'bg-primary-foreground/20' : 'bg-background'}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <div className="space-y-2 animate-pulse" role="status" aria-label="جارٍ التحميل">
              {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-muted" />)}
            </div>
          ) : (
            <ManagerNotificationList
              notifications={filtered}
              deviceName={deviceName}
              onEdit={startEdit}
              emptyText={statusFilter === 'all' ? 'لم يتم إرسال أي إشعار بعد' : 'لا توجد إشعارات بهذه الحالة'}
            />
          )}
        </section>
      </main>
    </div>
  );
}
