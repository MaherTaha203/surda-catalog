/**
 * Presentation Builder — history drawer (latest 20, brief §5).
 *
 * Open · Duplicate · Regenerate · Delete per item, plus Clear History. The store
 * caps the list at 20 automatically, so this stays a light recent-work list.
 */
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, FolderOpen, Copy, RefreshCw, Trash2, FileStack } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { usePresentations, deletePresentation, clearPresentations } from './store';
import type { Presentation } from './types';

interface Props {
  open: boolean;
  onClose: () => void;
  onOpen: (p: Presentation) => void;
  onDuplicate: (id: string) => void;
  onRegenerate: (p: Presentation) => void;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('ar', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function HistoryDrawer({ open, onClose, onOpen, onDuplicate, onRegenerate }: Props) {
  const list = usePresentations();
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 left-0 z-50 w-full max-w-sm bg-background border-e border-border flex flex-col"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            dir="rtl"
          >
            <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
              <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <FileStack size={16} className="text-primary" aria-hidden />
                العروض السابقة ({list.length})
              </h2>
              <div className="flex items-center gap-1">
                {list.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    مسح السجل
                  </button>
                )}
                <button type="button" onClick={onClose} aria-label="إغلاق" className="p-1.5 rounded-lg hover:bg-muted text-foreground">
                  <X size={18} aria-hidden />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {list.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-16">لا توجد عروض محفوظة بعد</p>
              ) : (
                list.map((p) => (
                  <div key={p.id} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.productIds.length} منتجات · {fmtDate(p.updatedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpen(p)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                      >
                        <FolderOpen size={13} aria-hidden /> فتح
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicate(p.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted text-foreground text-xs font-medium hover:bg-muted/70 transition-colors"
                      >
                        <Copy size={13} aria-hidden /> تكرار
                      </button>
                      <button
                        type="button"
                        onClick={() => onRegenerate(p)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted text-foreground text-xs font-medium hover:bg-muted/70 transition-colors"
                      >
                        <RefreshCw size={13} aria-hidden /> إعادة توليد
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(p.id)}
                        aria-label={`حذف ${p.name}`}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-destructive text-xs font-medium hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 size={13} aria-hidden /> حذف
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <p className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border">يُحفظ آخر 20 عرضاً فقط</p>
          </motion.aside>
        </>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="مسح سجل العروض"
        description="سيتم حذف كل العروض المحفوظة نهائياً. لا يمكن التراجع."
        confirmLabel="مسح الكل"
        destructive
        onConfirm={() => {
          clearPresentations();
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
      <ConfirmDialog
        open={confirmDelete != null}
        title="حذف العرض"
        description="سيتم حذف هذا العرض من السجل نهائياً."
        confirmLabel="حذف"
        destructive
        onConfirm={() => {
          if (confirmDelete) deletePresentation(confirmDelete);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </AnimatePresence>
  );
}
