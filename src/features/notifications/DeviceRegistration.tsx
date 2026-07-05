/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * Representative settings (spec §21): set / change this device's name once. The
 * name is stored locally and registered on the server so the manager can target
 * this device and read/completion tracking shows a friendly name.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Check } from 'lucide-react';
import { toast } from '@blinkdotnew/ui';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { getDeviceId, getDeviceName, setDeviceNameLocal } from './device';
import { useRegisterDevice } from './hooks';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Shown when the rep must set a name before continuing (first use). */
  requireName?: boolean;
  onSaved?: () => void;
}

export function DeviceRegistration({ open, onClose, requireName = false, onSaved }: Props) {
  const [name, setName] = useState('');
  const register = useRegisterDevice();
  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(cardRef, open);

  useEffect(() => {
    if (open) setName(getDeviceName());
  }, [open]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('يرجى إدخال اسم الجهاز');
      return;
    }
    register.mutate(
      { deviceId: getDeviceId(), deviceName: trimmed },
      {
        onSuccess: () => {
          setDeviceNameLocal(trimmed);
          toast.success('تم حفظ اسم الجهاز');
          onSaved?.();
          onClose();
        },
        onError: (err: Error) => toast.error(err.message || 'فشل حفظ اسم الجهاز'),
      },
    );
  };

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[70] bg-foreground/50 flex items-center justify-center p-4"
          onClick={onClose}
          dir="rtl"
        >
          <motion.div
            ref={cardRef}
            initial={{ scale: 0.95, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="device-reg-title"
            className="w-full max-w-sm bg-card rounded-2xl shadow-lg p-5"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Smartphone size={18} aria-hidden />
                </span>
                <h2 id="device-reg-title" className="text-base font-bold text-foreground">
                  اسم الجهاز
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
              {requireName
                ? 'عرّف هذا الجهاز باسم ليتمكّن المدير من إرسال الإشعارات إليه (مرة واحدة).'
                : 'يظهر هذا الاسم للمدير عند الإرسال وعند تتبّع القراءة والتنفيذ.'}
            </p>

            <form onSubmit={handleSave}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: تابلت أحمد"
                aria-label="اسم الجهاز"
                autoFocus
                className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring"
              />
              <button
                type="submit"
                disabled={register.isPending}
                className="mt-4 w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                <Check size={16} aria-hidden />
                {register.isPending ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalTarget,
  );
}
