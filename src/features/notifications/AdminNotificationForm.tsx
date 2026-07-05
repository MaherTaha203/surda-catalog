/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * Manager create / edit form. Recipient is a device dropdown (spec §2 — no
 * typing). Statement notifications carry ONE uploaded attachment (spec §1).
 * Edit reuses this form (allowed while status = new or read; enforced server-side).
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from '@blinkdotnew/ui';
import { Send, Paperclip, FileText, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { listProducts } from '@/api/products';
import { useCreateNotification, useEditNotification, useDevices } from './hooks';
import {
  uploadAttachment,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_ACCEPT,
  type NotificationInput,
} from './api';
import {
  NOTIFICATION_TYPES,
  TYPE_LABELS,
  ALL_DEVICES,
  ALL_DEVICES_LABEL,
  type NotificationType,
  type AttachmentType,
  type Notification,
} from './types';

interface Props {
  /** When set, the form edits this notification instead of creating a new one. */
  editing?: Notification | null;
  onDone: () => void;
  onCancelEdit?: () => void;
}

const inputCls =
  'w-full h-11 px-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring';

export function AdminNotificationForm({ editing, onDone, onCancelEdit }: Props) {
  const [type, setType] = useState<NotificationType>('message');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [deviceId, setDeviceId] = useState(ALL_DEVICES);
  const [customerId, setCustomerId] = useState('');
  const [productId, setProductId] = useState('');
  const [attachmentPath, setAttachmentPath] = useState<string | null>(null);
  const [attachmentType, setAttachmentType] = useState<AttachmentType | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: products = [] } = useQuery({ queryKey: ['admin-products'], queryFn: listProducts });
  const { data: devices = [] } = useDevices();
  const create = useCreateNotification();
  const edit = useEditNotification();

  // Prefill when entering edit mode.
  useEffect(() => {
    if (editing) {
      setType(editing.type);
      setTitle(editing.title);
      setMessage(editing.message);
      setDeviceId(editing.device_id || ALL_DEVICES);
      setCustomerId(editing.customer_id ?? '');
      setProductId(editing.product_id ?? '');
      setAttachmentPath(editing.attachment_path);
      setAttachmentType(editing.attachment_type);
    }
  }, [editing]);

  const productOptions = useMemo(() => products.map((p) => ({ id: p.id, name: p.name })), [products]);
  const needsProduct = type === 'product' || type === 'offer';
  const isStatement = type === 'statement';

  const resetForm = () => {
    setType('message');
    setTitle('');
    setMessage('');
    setDeviceId(ALL_DEVICES);
    setCustomerId('');
    setProductId('');
    setAttachmentPath(null);
    setAttachmentType(null);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    if (file.size > ATTACHMENT_MAX_BYTES) {
      toast.error('الحجم الأقصى للمرفق 20 ميغابايت');
      return;
    }
    setUploading(true);
    try {
      const res = await uploadAttachment(file);
      setAttachmentPath(res.path);
      setAttachmentType(res.type);
      toast.success('تم رفع المرفق');
    } catch (err) {
      toast.error((err as Error).message || 'فشل رفع المرفق');
    } finally {
      setUploading(false);
    }
  };

  const busy = create.isPending || edit.isPending || uploading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('العنوان مطلوب');
    if (needsProduct && !productId) return toast.error('اختر المنتج المرتبط بالإشعار');
    if (isStatement && !attachmentPath) return toast.error('أرفق ملف كشف الحساب (PDF أو صورة)');

    const selectedDevice = devices.find((d) => d.device_id === deviceId);
    const input: NotificationInput = {
      type,
      title: title.trim(),
      message: message.trim(),
      device_id: deviceId,
      device_name: deviceId === ALL_DEVICES ? ALL_DEVICES_LABEL : selectedDevice?.device_name ?? '',
      customer_id: customerId.trim() || null,
      product_id: needsProduct ? productId || null : null,
      attachment_path: isStatement ? attachmentPath : null,
      attachment_type: isStatement ? attachmentType : null,
    };

    if (editing) {
      edit.mutate(
        { id: editing.id, input },
        {
          onSuccess: () => {
            toast.success('تم تعديل الإشعار');
            onDone();
          },
          onError: (err: Error) => toast.error(err.message || 'فشل التعديل'),
        },
      );
    } else {
      create.mutate(input, {
        onSuccess: () => {
          toast.success('تم إنشاء الإشعار');
          resetForm();
          onDone();
        },
        onError: (err: Error) => toast.error(err.message || 'فشل إنشاء الإشعار'),
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">
          {editing ? 'تعديل الإشعار' : 'إنشاء إشعار جديد'}
        </h2>
        {editing && onCancelEdit && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
          >
            إلغاء التعديل
          </button>
        )}
      </div>

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
                type === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/70'
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label htmlFor="notif-title" className="block text-xs font-medium text-muted-foreground mb-1">العنوان</label>
        <input id="notif-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الإشعار" className={inputCls} />
      </div>

      {/* Message */}
      <div>
        <label htmlFor="notif-message" className="block text-xs font-medium text-muted-foreground mb-1">
          نص الرسالة {isStatement && <span className="text-muted-foreground/60">(اختياري — الكشف مرفق)</span>}
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

      {/* Statement attachment */}
      {isStatement && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            المرفق <span className="text-muted-foreground/60">(PDF أو صورة — 20MB كحد أقصى)</span>
          </label>
          {attachmentPath ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-muted/40">
              {attachmentType === 'pdf' ? (
                <FileText size={18} className="text-emerald-600 shrink-0" aria-hidden />
              ) : (
                <ImageIcon size={18} className="text-emerald-600 shrink-0" aria-hidden />
              )}
              <span className="flex-1 min-w-0 truncate text-sm text-foreground">
                {attachmentType === 'pdf' ? 'ملف PDF مرفق' : 'صورة مرفقة'}
              </span>
              <button
                type="button"
                onClick={() => { setAttachmentPath(null); setAttachmentType(null); }}
                aria-label="إزالة المرفق"
                className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 h-11 px-3 rounded-xl border border-dashed border-border bg-card text-sm text-muted-foreground cursor-pointer hover:border-ring hover:text-foreground transition-colors">
              {uploading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Paperclip size={16} aria-hidden />}
              {uploading ? 'جارٍ الرفع...' : 'اختر ملفاً'}
              <input type="file" accept={ATTACHMENT_ACCEPT} onChange={handleFile} disabled={uploading} className="hidden" />
            </label>
          )}
        </div>
      )}

      {/* Recipient device dropdown */}
      <div>
        <label htmlFor="notif-device" className="block text-xs font-medium text-muted-foreground mb-1">المرسل إليه</label>
        <select id="notif-device" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className={inputCls}>
          <option value={ALL_DEVICES}>{ALL_DEVICES_LABEL}</option>
          {devices.map((d) => (
            <option key={d.device_id} value={d.device_id}>{d.device_name}</option>
          ))}
        </select>
        {devices.length === 0 && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            لا توجد أجهزة مُسجّلة بعد — سيصل الإشعار إلى كل الأجهزة. يسجّل المندوب اسم جهازه من أيقونة الجرس.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Customer (optional) */}
        <div>
          <label htmlFor="notif-customer" className="block text-xs font-medium text-muted-foreground mb-1">
            العميل <span className="text-muted-foreground/60">(اختياري)</span>
          </label>
          <input id="notif-customer" type="text" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="اسم أو رقم العميل" className={inputCls} />
        </div>

        {/* Product (required for product & offer) */}
        <div>
          <label htmlFor="notif-product" className="block text-xs font-medium text-muted-foreground mb-1">
            المنتج <span className="text-muted-foreground/60">{needsProduct ? '(مطلوب)' : '(اختياري)'}</span>
          </label>
          <select id="notif-product" value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
            <option value="">— بدون منتج —</option>
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        <Send size={16} aria-hidden />
        {busy ? 'جارٍ الحفظ...' : editing ? 'حفظ التعديل' : 'إرسال الإشعار'}
      </button>
    </form>
  );
}
