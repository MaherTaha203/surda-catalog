import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { PinPad } from '@/components/PinPad';
import { getAdminPin } from '@/lib/storage';

interface AdminPinDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Admin PIN entry as a modal dialog — opened from the small lock icon in the
 * catalog header. Wrong PIN shakes and stays (the user remains in the
 * catalog); Escape / backdrop / × close it.
 */
export function AdminPinDialog({ open, onClose, onSuccess }: AdminPinDialogProps) {
  // Lock the page scroll behind the dialog (same rule as every other modal).
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4"
          onClick={onClose}
          dir="rtl"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="رمز المدير"
            className="relative w-full max-w-sm bg-background rounded-2xl shadow-lg p-6 pt-10"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="absolute top-3 left-3 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X size={18} />
            </button>
            {/* PinPad owns the keyboard (digits/Backspace) and maps Escape to onBack */}
            <PinPad
              title="رمز المدير"
              subtitle="أدخل رمز المدير للوصول إلى لوحة التحكم"
              correctPin={getAdminPin()}
              onSuccess={onSuccess}
              onBack={onClose}
              hideBackButton
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
