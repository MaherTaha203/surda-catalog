/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * Full notification history (spec §8): status filters + free-text search over
 * title, representative (device name), date, and type. PIN-gated like the admin
 * panel. Reuses ManagerNotificationList so the same actions/tracking apply.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { ArrowRight, History, Search, X } from 'lucide-react';
import { isAdminUnlocked, isPinUnlocked } from '@/lib/storage';
import { useIsClient } from '@/hooks/useIsClient';
import { ManagerNotificationList } from './ManagerNotificationList';
import { useAllNotifications, useDevices } from './hooks';
import { makeDeviceNameResolver, filterNotifications } from './filters';
import {
  NOTIFICATION_STATUSES,
  NOTIFICATION_TYPES,
  STATUS_LABELS,
  TYPE_LABELS,
  type NotificationStatus,
  type NotificationType,
} from './types';

const STATUS_FILTERS: ('all' | NotificationStatus)[] = ['all', ...NOTIFICATION_STATUSES];
const TYPE_FILTERS: ('all' | NotificationType)[] = ['all', ...NOTIFICATION_TYPES];

export function NotificationHistoryPage() {
  const navigate = useNavigate();
  const isClient = useIsClient();
  const unlocked = isClient && isPinUnlocked() && isAdminUnlocked();

  useEffect(() => {
    if (isClient && !unlocked) navigate({ to: '/', replace: true });
  }, [unlocked, navigate, isClient]);

  const { data: notifications = [], isLoading } = useAllNotifications(unlocked);
  const { data: devices = [] } = useDevices(unlocked);
  const deviceName = useMemo(() => makeDeviceNameResolver(devices), [devices]);

  const [status, setStatus] = useState<'all' | NotificationStatus>('all');
  const [type, setType] = useState<'all' | NotificationType>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => filterNotifications(notifications, { status, type, search }, deviceName),
    [notifications, status, type, search, deviceName],
  );

  if (!unlocked) return null;

  return (
    <div className="min-h-dvh bg-background" dir="rtl">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 flex items-center gap-1.5 sm:gap-3">
          <Link
            to="/notifications"
            aria-label="الإشعارات"
            className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowRight size={18} aria-hidden />
            <span className="hidden sm:inline">الإشعارات</span>
          </Link>
          <h1 className="flex items-center gap-2 text-base sm:text-lg font-bold text-foreground whitespace-nowrap">
            <History size={18} className="text-primary" aria-hidden />
            سجل الإشعارات
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالعنوان أو المندوب أو التاريخ..."
            aria-label="بحث في السجل"
            className="w-full h-10 pr-10 pl-9 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="مسح البحث"
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                status === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/70'
              }`}
            >
              {s === 'all' ? 'كل الحالات' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                type === t ? 'bg-accent text-accent-foreground' : 'bg-muted text-foreground hover:bg-muted/70'
              }`}
            >
              {t === 'all' ? 'كل الأنواع' : TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">{filtered.length} من {notifications.length} إشعار</p>

        {isLoading ? (
          <div className="space-y-2 animate-pulse" role="status" aria-label="جارٍ التحميل">
            {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-muted" />)}
          </div>
        ) : (
          <ManagerNotificationList
            notifications={filtered}
            deviceName={deviceName}
            onEdit={(n) => navigate({ to: '/notifications', search: { edit: n.id } })}
            emptyText="لا توجد نتائج مطابقة"
          />
        )}
      </main>
    </div>
  );
}
