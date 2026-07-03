import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions get a red confirm button. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The app's confirmation dialog — replaces every browser-native confirm() so
 * all dialogs share one visual identity (same card, motion, and buttons as
 * the product form modal).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Escape cancels. Registered only while open, after any parent modal's own
  // Escape handler — parents guard on `open` to let the dialog win.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] bg-foreground/50 flex items-center justify-center p-4"
          onClick={onCancel}
          dir="rtl"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className="w-full max-w-sm bg-card rounded-2xl shadow-lg p-5"
          >
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  destructive ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                }`}
              >
                <AlertTriangle size={20} aria-hidden />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h2 id="confirm-dialog-title" className="text-base font-bold text-foreground">
                  {title}
                </h2>
                {description && (
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                autoFocus
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 ${
                  destructive
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
