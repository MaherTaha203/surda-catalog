/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible).
 *
 * Manager's "create notification" form. Fields (spec):
 *   نوع الإشعار · عنوان · نص الرسالة · المرسل إليه · العميل (اختياري) · المنتج (اختياري)
 * New notifications are always created with status "جديد" (server default).
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@blinkdotnew/ui';
import { Send } from 'lucide-react';
import { listProducts } from '@/api/products';
import { createNotification } from './api';
import { NOTIFICATIONS_KEY, NOTIFICATIONS_ALL_KEY } from './hooks';
import {
  NOTIFICATION_TYPES,
  TYPE_LABELS,
  type Notification,
  type NotificationType,
} from './types';

interface Props {
  onCreated: () => void;
}

const inputCls =
  'w-full h-11 px-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring';

export function AdminNotificationForm({ onCreated }: Props) {
  const [type, setType] = useState<NotificationType>('message');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [deviceId, setDeviceId] = useState('all');
  const [customerId, setCustomerId] = useState('');
  const [productId, setProductId] = useState('');
  const queryClient = useQueryClient();

  // Products list — only needed to pick a target product for product/offer types.
  const { data: products = [] } = useQuery({
    queryKey: ['admin-products'],
    queryFn: listProducts,
  });
  const productOptions = useMemo(
    () => products.map((p) => ({ id: p.id, name: p.name })),
    [products],
  );

  const needsProduct = type === 'product' || type === 'offer';

  const mutation = useMutation({
    mutationFn: () =>
      createNotification({
        type,
        title: title.trim(),
        message: message.trim(),
        device_id: deviceId.trim() || 'all',
        customer_id: customerId.trim() || null,
        product_id: needsProduct ? productId || null : null,
      }),
    onSuccess: (created: Notification) => {
      toast.success('تم إنشاء الإشعار');
      setTitle('');
      setMessage('');
      setCustomerId('');
      setProductId('');
      // Show it in the manager list immediately (optimistic), so a fast create →
      // list refresh never races an in-flight poll. Then invalidate so every
      // notifications view (manager + delegate feed) reconciles with the server.
      queryClient.setQueryData<Notification[]>(NOTIFICATIONS_ALL_KEY, (old) =>
        old && !old.some((n) => n.id === created.id) ? [created, ...old] : old,
      );
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message || 'فشل إنشاء الإشعار'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('العنوان مطلوب');
      return;
    }
    if (needsProduct && !productId) {
      toast.error('اختر المنتج المرتبط بالإشعار');
      return;
    }
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <h2 className="text-base font-bold text-foreground">إنشاء إشعار جديد</h2>

      {/* Type */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">نوع الإشعار</label>
        <div className="flex flex-wrap gap-2">
          {NOTIFICATION_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                type === t
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground hover:bg-muted/70'
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label htmlFor="notif-title" className="block text-xs font-medium text-muted-foreground mb-1">
          العنوان
        </label>
        <input
          id="notif-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان الإشعار"
          className={inputCls}
        />
      </div>

      {/* Message */}
      <div>
        <label htmlFor="notif-message" className="block text-xs font-medium text-muted-foreground mb-1">
          نص الرسالة
        </label>
        <textarea
          id="notif-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="اكتب نص الرسالة..."
          rows={3}
          className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring resize-y"
        />
      </div>

      {/* Recipient */}
      <div>
        <label htmlFor="notif-device" className="block text-xs font-medium text-muted-foreground mb-1">
          المرسل إليه
        </label>
        <input
          id="notif-device"
          type="text"
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          placeholder="all"
          className={inputCls}
          dir="ltr"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          اترك <span className="font-mono">all</span> للإرسال إلى جميع المندوبين، أو أدخل معرّف جهاز محدد.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Customer (optional) */}
        <div>
          <label htmlFor="notif-customer" className="block text-xs font-medium text-muted-foreground mb-1">
            العميل <span className="text-muted-foreground/60">(اختياري)</span>
          </label>
          <input
            id="notif-customer"
            type="text"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder="اسم أو رقم العميل"
            className={inputCls}
          />
        </div>

        {/* Product (optional / required for product & offer) */}
        <div>
          <label htmlFor="notif-product" className="block text-xs font-medium text-muted-foreground mb-1">
            المنتج{' '}
            <span className="text-muted-foreground/60">
              {needsProduct ? '(مطلوب)' : '(اختياري)'}
            </span>
          </label>
          <select
            id="notif-product"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className={inputCls}
          >
            <option value="">— بدون منتج —</option>
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        <Send size={16} aria-hidden />
        {mutation.isPending ? 'جارٍ الإرسال...' : 'إرسال الإشعار'}
      </button>
    </form>
  );
}
