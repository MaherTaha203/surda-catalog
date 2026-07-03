import { useState } from 'react';
import { Edit, Trash2, Eye, EyeOff, Package, GripVertical } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Product } from '@/types/product';

interface AdminProductRowProps {
  product: Product;
  /** Reordering is unavailable while saving or while the list is filtered. */
  dragDisabled?: boolean;
  /** This row is currently being dragged (lifted styling). */
  dragging?: boolean;
  deleteDisabled?: boolean;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onToggleHide: (id: string, currentHidden: number) => void;
}

/**
 * One admin list row. Reordering is drag & drop — mouse-drag the row on
 * desktop, long-press then drag on touch — handled by the parent list; this
 * component only renders the grip affordance and the lifted state.
 */
export function AdminProductRow({
  product, dragDisabled, dragging, deleteDisabled,
  onEdit, onDelete, onToggleHide,
}: AdminProductRowProps) {
  const hidden = Number(product.isHidden) > 0;
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors select-none ${
        dragging
          ? 'bg-card border-primary/40 shadow-lg'
          : hidden
            ? 'bg-muted/50 border-border/50 opacity-70'
            : 'bg-card border-border'
      } ${dragDisabled ? '' : 'cursor-grab'} ${dragging ? 'cursor-grabbing' : ''}`}
    >
      {/* Drag affordance */}
      {!dragDisabled && (
        <GripVertical size={16} className="shrink-0 text-muted-foreground/40" aria-hidden />
      )}
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" draggable={false} className="w-full h-full object-contain" />
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
    </div>
  );
}
