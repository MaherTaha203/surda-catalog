/**
 * Bulk image import — quick entry editor (one product at a time).
 *
 * Keyboard-driven for fast data entry over hundreds of pre-uploaded images:
 *   Tab           — move between fields (native)
 *   Enter / ↓      — save current and go to the next product
 *   ↑              — save current and go to the previous product
 * The image is fixed (already uploaded) — the admin only fills fields. Moving
 * autosaves (handled by the parent via onNavigate).
 */
import { useEffect, useRef } from 'react';
import { Check, ChevronRight, ChevronLeft, Loader2, CircleCheck } from 'lucide-react';
import { CATEGORY_OPTIONS, CATEGORY_WITH_SIZE, isRowComplete, type ImportRow } from './types';
import type { ProductCategory } from '@/types/product';

interface Props {
  row: ImportRow;
  onChange: (localId: string, patch: Partial<ImportRow>) => void;
  /** delta = +1 next, -1 prev. Parent autosaves the current row, then moves. */
  onNavigate: (delta: number) => void;
  saving: boolean;
}

const field =
  'w-full px-3 py-2 rounded-xl border border-border bg-background text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';

export function QuickEntryEditor({ row, onChange, onNavigate, saving }: Props) {
  const nameRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<ImportRow>) => onChange(row.localId, patch);
  const showSize = row.category === CATEGORY_WITH_SIZE;
  const complete = isRowComplete(row);

  // Focus the name field whenever the product changes — keeps the flow on the keyboard.
  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
  }, [row.localId]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const isTextarea = (e.target as HTMLElement).tagName === 'TEXTAREA';
    if (isTextarea) return; // let ↑/↓/Enter behave normally inside the description
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      onNavigate(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onNavigate(-1);
    }
  };

  return (
    <div
      className="rounded-2xl border border-border bg-card p-4 space-y-3"
      onKeyDown={onKeyDown}
    >
      <div className="flex gap-4">
        <div className="w-32 h-32 sm:w-40 sm:h-40 shrink-0 rounded-2xl overflow-hidden bg-muted">
          {row.previewUrl && (
            <img src={row.previewUrl} alt={row.name || row.fileName} className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">اسم المنتج</label>
            <input
              ref={nameRef}
              className={`${field} font-semibold`}
              value={row.name}
              placeholder="اسم المنتج"
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">التصنيف</label>
              <select
                className={field}
                value={row.category}
                onChange={(e) => set({ category: e.target.value as ProductCategory })}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {showSize && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">الحجم</label>
                <input className={field} value={row.size} onChange={(e) => set({ size: e.target.value })} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">سعر الكرتونة</label>
          <input className={field} type="number" min={0} inputMode="decimal" value={row.cartonPrice} onChange={(e) => set({ cartonPrice: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">سعر العرض</label>
          <input className={field} type="number" min={0} inputMode="decimal" value={row.offerPrice} onChange={(e) => set({ offerPrice: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">كمية العرض</label>
          <input className={field} type="number" min={0} inputMode="numeric" value={row.offerQuantity} onChange={(e) => set({ offerQuantity: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">كمية البونص</label>
          <input className={field} type="number" min={0} inputMode="numeric" value={row.bonusQuantity} onChange={(e) => set({ bonusQuantity: e.target.value })} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">الوصف</label>
        <textarea className={`${field} resize-none`} rows={2} value={row.description} onChange={(e) => set({ description: e.target.value })} />
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2 text-xs">
          {saving ? (
            <span className="flex items-center gap-1 text-muted-foreground"><Loader2 size={13} className="animate-spin" aria-hidden /> جارٍ الحفظ…</span>
          ) : complete ? (
            <span className="flex items-center gap-1 text-green-600"><CircleCheck size={14} aria-hidden /> مكتمل</span>
          ) : (
            <span className="flex items-center gap-1 text-amber-600">يحتاج اسماً وسعراً</span>
          )}
          {row.published && (
            <span className="flex items-center gap-1 text-primary"><Check size={13} aria-hidden /> منشور</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onNavigate(-1)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/70 transition-colors"
          >
            <ChevronRight size={16} aria-hidden /> السابق
          </button>
          <button
            type="button"
            onClick={() => onNavigate(1)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            التالي <ChevronLeft size={16} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
