import { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit, Trash2, Eye, EyeOff, Package } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Product } from '@/types/product';

interface AdminProductRowProps {
  product: Product;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  /** Reordering is unavailable while a reorder is saving or the list is filtered. */
  reorderDisabled?: boolean;
  deleteDisabled?: boolean;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onToggleHide: (id: string, currentHidden: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function AdminProductRow({
  product, index, isFirst, isLast, reorderDisabled, deleteDisabled,
  onEdit, onDelete, onToggleHide, onMoveUp, onMoveDown,
}: AdminProductRowProps) {
  const hidden = Number(product.isHidden) > 0;
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      // Cap the stagger so long lists don't take seconds to finish appearing.
      transition={{ duration: 0.25, delay: Math.min(index, 10) * 0.04 }}
      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
        hidden ? 'bg-muted/50 border-border/50 opacity-70' : 'bg-card border-border'
      }`}
    >
      {/* Reorder buttons */}
      <div className="hidden sm:flex flex-col items-center gap-0.5 text-muted-foreground/40">
        <button type="button" onClick={onMoveUp} disabled={isFirst || reorderDisabled} aria-label="نقل لأعلى"
          className="hover:text-foreground transition-colors disabled:opacity-20">▲</button>
        <button type="button" onClick={onMoveDown} disabled={isLast || reorderDisabled} aria-label="نقل لأسفل"
          className="hover:text-foreground transition-colors disabled:opacity-20">▼</button>
      </div>
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-contain" />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-muted-foreground"><Package size={20} aria-hidden /></div>
        )}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate">{product.name}</p>
        <p className="text-xs text-muted-foreground">{product.category} · ₪{Number(product.cartonPrice).toLocaleString('en-US')}</p>
      </div>
      {/* Hidden badge */}
      {hidden && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium shrink-0">مخفي</span>
      )}
      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={() => onToggleHide(product.id, Number(product.isHidden))}
          aria-label={hidden ? 'إظهار المنتج' : 'إخفاء المنتج'}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <button type="button" onClick={() => onEdit(product)} aria-label="تعديل المنتج"
          className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
          <Edit size={16} />
        </button>
        <button type="button" disabled={deleteDisabled}
          onClick={() => setConfirmDelete(true)}
          aria-label="حذف المنتج"
          className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40">
          <Trash2 size={16} />
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="حذف المنتج"
        description={`سيتم حذف «${product.name}» نهائياً مع صورته. لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف"
        destructive
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete(product.id);
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </motion.div>
  );
}
