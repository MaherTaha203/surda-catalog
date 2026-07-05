/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * Manager maintenance tools — keep the notification center light (it is not an
 * archive). Two parts:
 *   1. Retention window: how many days completed / cancelled notifications live
 *      before the server sweeps them automatically (0 = keep until deleted).
 *   2. Bulk purge actions: delete all completed, delete all cancelled, or clean
 *      the whole center except brand-new (unread) notifications. Every purge
 *      also removes the attachments of the rows it deletes.
 * All destructive actions confirm first via ConfirmDialog.
 */
import { useEffect, useState } from 'react';
import { toast } from '@blinkdotnew/ui';
import { Trash2, Ban, Sparkles, Save, Clock } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
  usePurgeCompleted,
  usePurgeCancelled,
  useCleanupNotifications,
} from './hooks';

interface Props {
  enabled: boolean;
  completedCount: number;
  cancelledCount: number;
  /** read + completed + cancelled — everything a full cleanup would remove. */
  cleanableCount: number;
}

type PendingPurge = 'completed' | 'cancelled' | 'cleanup' | null;

export function NotificationMaintenance({ enabled, completedCount, cancelledCount, cleanableCount }: Props) {
  const { data: settings } = useNotificationSettings(enabled);
  const saveSettings = useUpdateNotificationSettings();
  const purgeCompleted = usePurgeCompleted();
  const purgeCancelled = usePurgeCancelled();
  const cleanup = useCleanupNotifications();

  const [completedDays, setCompletedDays] = useState('7');
  const [cancelledDays, setCancelledDays] = useState('3');
  const [pending, setPending] = useState<PendingPurge>(null);

  // Sync inputs from the server once settings load.
  useEffect(() => {
    if (settings) {
      setCompletedDays(String(settings.completed_retention_days));
      setCancelledDays(String(settings.cancelled_retention_days));
    }
  }, [settings]);

  const dirty =
    settings != null &&
    (Number(completedDays) !== settings.completed_retention_days ||
      Number(cancelledDays) !== settings.cancelled_retention_days);

  const saveRetention = () => {
    saveSettings.mutate(
      {
        completed_retention_days: Math.max(0, Math.trunc(Number(completedDays) || 0)),
        cancelled_retention_days: Math.max(0, Math.trunc(Number(cancelledDays) || 0)),
      },
      {
        onSuccess: () => toast.success('تم حفظ مدة الاحتفاظ'),
        onError: (e: Error) => toast.error(e.message || 'فشل الحفظ'),
      },
    );
  };

  const runPurge = () => {
    const done = (label: string) => (res: { deleted: number }) =>
      toast.success(res.deleted ? `تم حذف ${res.deleted} إشعار — ${label}` : 'لا توجد إشعارات للحذف');
    const fail = (e: Error) => toast.error(e.message || 'فشل الحذف');
    if (pending === 'completed') purgeCompleted.mutate(undefined, { onSuccess: done('المنفذة'), onError: fail });
    else if (pending === 'cancelled') purgeCancelled.mutate(undefined, { onSuccess: done('الملغاة'), onError: fail });
    else if (pending === 'cleanup') cleanup.mutate(undefined, { onSuccess: done('تنظيف'), onError: fail });
    setPending(null);
  };

  const busy = purgeCompleted.isPending || purgeCancelled.isPending || cleanup.isPending;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Clock size={16} className="text-primary" aria-hidden />
        <h2 className="text-sm font-bold text-foreground">إدارة مركز الإشعارات</h2>
      </div>

      {/* Retention window */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          تُحذف الإشعارات المنفذة والملغاة تلقائياً بعد المدة المحددة (0 = بدون حذف تلقائي).
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-foreground">
            حذف المنفذة بعد (أيام)
            <input
              type="number"
              min={0}
              max={365}
              inputMode="numeric"
              value={completedDays}
              onChange={(e) => setCompletedDays(e.target.value)}
              className="w-24 px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-foreground">
            حذف الملغاة بعد (أيام)
            <input
              type="number"
              min={0}
              max={365}
              inputMode="numeric"
              value={cancelledDays}
              onChange={(e) => setCancelledDays(e.target.value)}
              className="w-24 px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground"
            />
          </label>
          <button
            type="button"
            onClick={saveRetention}
            disabled={!dirty || saveSettings.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
          >
            <Save size={13} aria-hidden /> حفظ
          </button>
        </div>
      </div>

      {/* Bulk purge */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
        <button
          type="button"
          disabled={busy || completedCount === 0}
          onClick={() => setPending('completed')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-100 text-green-700 text-xs font-medium disabled:opacity-40 hover:bg-green-200 transition-colors"
        >
          <Trash2 size={14} aria-hidden /> حذف المنفذة ({completedCount})
        </button>
        <button
          type="button"
          disabled={busy || cancelledCount === 0}
          onClick={() => setPending('cancelled')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted text-foreground text-xs font-medium disabled:opacity-40 hover:bg-muted/70 transition-colors"
        >
          <Ban size={14} aria-hidden /> حذف الملغاة ({cancelledCount})
        </button>
        <button
          type="button"
          disabled={busy || cleanableCount === 0}
          onClick={() => setPending('cleanup')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-medium disabled:opacity-40 hover:bg-destructive/20 transition-colors"
        >
          <Sparkles size={14} aria-hidden /> تنظيف المركز (عدا الجديدة)
        </button>
      </div>

      <ConfirmDialog
        open={pending === 'completed'}
        title="حذف جميع الإشعارات المنفذة"
        description="سيتم حذف كل الإشعارات المنفذة ومرفقاتها نهائياً. لا يمكن التراجع."
        confirmLabel="حذف الكل"
        destructive
        onConfirm={runPurge}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending === 'cancelled'}
        title="حذف جميع الإشعارات الملغاة"
        description="سيتم حذف كل الإشعارات الملغاة ومرفقاتها نهائياً. لا يمكن التراجع."
        confirmLabel="حذف الكل"
        destructive
        onConfirm={runPurge}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending === 'cleanup'}
        title="تنظيف مركز الإشعارات"
        description="سيتم حذف كل الإشعارات (المقروءة والمنفذة والملغاة) ومرفقاتها، ويبقى فقط الإشعارات الجديدة غير المقروءة. لا يمكن التراجع."
        confirmLabel="تنظيف الآن"
        destructive
        onConfirm={runPurge}
        onCancel={() => setPending(null)}
      />
    </section>
  );
}
