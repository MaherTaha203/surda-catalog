/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * Manager dashboard rows (spec §20): Type, Recipient, Status, Created, Read,
 * Completed, Actions. Actions depend on status (spec §3):
 *   new       → Edit + Delete
 *   read      → Cancel
 *   completed → read-only
 *   cancelled → read-only
 * All destructive actions use the app ConfirmDialog — never browser confirm()
 * (spec §19).
 */
import { useState } from 'react';
import { toast } from '@blinkdotnew/ui';
import { Pencil, Trash2, Ban, Bell } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useDeleteNotification, useCancelNotification } from './hooks';
import {
  TYPE_ICONS,
  TYPE_LABELS,
  TYPE_TINT,
  STATUS_LABELS,
  STATUS_TINT,
  formatDateTime,
  type Notification,
} from './types';

interface Props {
  notifications: Notification[];
  /** device_id → friendly name (for Read By / Completed By / Recipient). */
  deviceName: (deviceId: string | null) => string;
  onEdit: (n: Notification) => void;
  emptyText?: string;
}

type Pending =
  | { kind: 'delete' | 'cancel' | 'edit'; n: Notification }
  | null;

export function ManagerNotificationList({ notifications, deviceName, onEdit, emptyText }: Props) {
  const del = useDeleteNotification();
  const cancel = useCancelNotification();
  const [pending, setPending] = useState<Pending>(null);

  const confirmAction = () => {
    if (!pending) return;
    const { kind, n } = pending;
    if (kind === 'delete') {
      del.mutate(n.id, {
        onSuccess: () => toast.success('تم حذف الإشعار'),
        onError: (e: Error) => toast.error(e.message || 'فشل الحذف'),
      });
    } else if (kind === 'cancel') {
      cancel.mutate(n.id, {
        onSuccess: () => toast.success('تم إلغاء الإشعار'),
        onError: (e: Error) => toast.error(e.message || 'فشل الإلغاء'),
      });
    } else if (kind === 'edit') {
      onEdit(n);
    }
    setPending(null);
  };

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Bell size={40} className="text-muted-foreground/30 mb-3" strokeWidth={1} aria-hidden />
        <p className="text-sm text-muted-foreground">{emptyText ?? 'لا توجد إشعارات'}</p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {notifications.map((n) => {
          const Icon = TYPE_ICONS[n.type];
          return (
            <li key={n.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start gap-3">
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
                  {n.message && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>}

                  {/* Tracking grid */}
                  <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>النوع: {TYPE_LABELS[n.type]}</span>
                    <span>المرسل إليه: {n.device_name || deviceName(n.device_id)}</span>
                    <span>أُنشئ: {formatDateTime(n.created_at)}</span>
                    <span>
                      القراءة:{' '}
                      {n.read_at ? `${deviceName(n.read_by)} · ${formatDateTime(n.read_at)}` : '—'}
                    </span>
                    {n.completed_at && (
                      <span>التنفيذ: {deviceName(n.completed_by)} · {formatDateTime(n.completed_at)}</span>
                    )}
                    {n.cancelled_at && <span>الإلغاء: {formatDateTime(n.cancelled_at)}</span>}
                    {n.customer_id && <span>العميل: {n.customer_id}</span>}
                  </div>

                  {/* Actions (spec §3) */}
                  <div className="mt-2 flex items-center gap-1.5">
                    {n.status === 'new' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPending({ kind: 'edit', n })}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted text-foreground text-xs font-medium hover:bg-muted/70 transition-colors"
                        >
                          <Pencil size={13} aria-hidden /> تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => setPending({ kind: 'delete', n })}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
                        >
                          <Trash2 size={13} aria-hidden /> حذف
                        </button>
                      </>
                    )}
                    {n.status === 'read' && (
                      <button
                        type="button"
                        onClick={() => setPending({ kind: 'cancel', n })}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted text-foreground text-xs font-medium hover:bg-muted/70 transition-colors"
                      >
                        <Ban size={13} aria-hidden /> إلغاء
                      </button>
                    )}
                    {(n.status === 'completed' || n.status === 'cancelled') && (
                      <span className="text-[11px] text-muted-foreground">للقراءة فقط</span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={pending?.kind === 'delete'}
        title="حذف الإشعار"
        description="سيُحذف هذا الإشعار نهائياً. لا يمكن التراجع."
        confirmLabel="حذف"
        destructive
        onConfirm={confirmAction}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending?.kind === 'cancel'}
        title="إلغاء الإشعار"
        description="سيصبح الإشعار ملغى، ويختفي فوراً عند المندوبين الذين لم يفتحوه بعد."
        confirmLabel="إلغاء الإشعار"
        cancelLabel="رجوع"
        destructive
        onConfirm={confirmAction}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending?.kind === 'edit'}
        title="تعديل الإشعار"
        description="يمكن التعديل قبل قراءة المندوب فقط. هل تريد المتابعة؟"
        confirmLabel="تعديل"
        onConfirm={confirmAction}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
