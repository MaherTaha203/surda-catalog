/**
 * Presentation Builder — selected products (rail).
 *
 * Drag to reorder (presentation order is independent from catalog order, brief
 * §2), tap ✕ to remove instantly. Reuses the app's useDragReorder so the gesture
 * matches the admin product list the rep already knows.
 */
import { motion } from 'framer-motion';
import { GripVertical, X, Plus, PackageOpen } from 'lucide-react';
import type { Product } from '@/types/product';
import { resolveThumbUrl } from '@/api/client';
import { useDragReorder } from '@/hooks/useDragReorder';

interface Props {
  products: Product[];
  showPrice: boolean;
  onReorder: (ids: string[]) => void;
  onRemove: (id: string) => void;
  onAddClick: () => void;
}

export function SelectedProductsPanel({ products, showPrice, onReorder, onRemove, onAddClick }: Props) {
  const { session, onMouseDown, onTouchStart } = useDragReorder<Product>({
    items: products,
    disabled: products.length < 2,
    onCommit: (order) => onReorder(order.map((p) => p.id)),
  });
  const display = session?.order ?? products;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-foreground">المنتجات ({products.length})</span>
        <button
          type="button"
          onClick={onAddClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} aria-hidden /> إضافة منتجات
        </button>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-2 text-center py-8 text-muted-foreground">
          <PackageOpen size={32} strokeWidth={1} aria-hidden />
          <p className="text-xs">لا توجد منتجات بعد — أضف من الكتالوج</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {display.map((p) => {
            const dragging = session?.id === p.id;
            const thumb = p.imageUrl ? resolveThumbUrl(p.imageUrl) : '';
            return (
              <motion.li
                key={p.id}
                layout={session ? !dragging : false}
                style={dragging ? { y: session!.dy, zIndex: 30, position: 'relative' } : undefined}
                className={`flex items-center gap-2 rounded-xl border bg-card p-2 ${dragging ? 'border-primary shadow-lg' : 'border-border'}`}
              >
                <button
                  type="button"
                  aria-label="إعادة ترتيب"
                  onMouseDown={(e) => onMouseDown(e, p.id)}
                  onTouchStart={(e) => onTouchStart(e, p.id)}
                  className="cursor-grab touch-none text-muted-foreground hover:text-foreground p-0.5"
                >
                  <GripVertical size={16} aria-hidden />
                </button>
                <div className="w-9 h-9 rounded-lg bg-muted overflow-hidden shrink-0">
                  {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                  {showPrice && Number(p.cartonPrice) > 0 && (
                    <p className="text-[11px] text-accent font-medium">₪{Number(p.cartonPrice).toLocaleString('en-US')}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  aria-label={`إزالة ${p.name}`}
                  className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <X size={15} aria-hidden />
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
