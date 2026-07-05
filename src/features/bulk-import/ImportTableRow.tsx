/**
 * Bulk image import — one editable product row (Phase 2 table).
 *
 * Memoized so typing in one row never re-renders the other 300. The image is
 * shown from its local preview and is NEVER re-uploaded here — only the fields
 * are edited, then saved individually or via "create all".
 */
import { memo } from 'react';
import { Check, Save, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { CATEGORY_OPTIONS, CATEGORY_WITH_SIZE, type ImportRow } from './types';
import type { ProductCategory } from '@/types/product';

interface Props {
  row: ImportRow;
  index: number;
  onChange: (localId: string, patch: Partial<ImportRow>) => void;
  onSave: (localId: string) => void;
  onRemove: (localId: string) => void;
  saving: boolean;
}

const field =
  'w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';

function ImportTableRowInner({ row, index, onChange, onSave, onRemove, saving }: Props) {
  const set = (patch: Partial<ImportRow>) => onChange(row.localId, patch);
  const created = row.createdId != null;
  const showSize = row.category === CATEGORY_WITH_SIZE;

  return (
    <li className="rounded-2xl border border-border bg-card p-3">
      <div className="flex gap-3">
        {/* Image (upload status overlay) */}
        <div className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-muted">
          {row.previewUrl ? (
            <img src={row.previewUrl} alt={row.name || row.fileName} className="w-full h-full object-cover" />
          ) : null}
          {row.upload === 'uploading' && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
              <Loader2 size={18} className="animate-spin" aria-hidden />
            </span>
          )}
          {row.upload === 'error' && (
            <span className="absolute inset-0 flex items-center justify-center bg-destructive/70 text-white" title={row.uploadError}>
              <AlertCircle size={18} aria-hidden />
            </span>
          )}
          <span className="absolute top-0.5 start-0.5 px-1 rounded bg-black/50 text-white text-[10px] font-medium">
            {index + 1}
          </span>
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {/* Name (auto-suggested from filename, editable) */}
          <input
            className={`${field} font-medium`}
            value={row.name}
            placeholder="اسم المنتج"
            aria-label="اسم المنتج"
            onChange={(e) => set({ name: e.target.value })}
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <select
              className={field}
              value={row.category}
              aria-label="التصنيف"
              onChange={(e) => set({ category: e.target.value as ProductCategory })}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {showSize && (
              <input
                className={field}
                value={row.size}
                placeholder="الحجم"
                aria-label="الحجم"
                onChange={(e) => set({ size: e.target.value })}
              />
            )}
            <input
              className={field}
              type="number"
              min={0}
              inputMode="decimal"
              value={row.cartonPrice}
              placeholder="سعر الكرتونة"
              aria-label="سعر الكرتونة"
              onChange={(e) => set({ cartonPrice: e.target.value })}
            />
            <input
              className={field}
              type="number"
              min={0}
              inputMode="decimal"
              value={row.offerPrice}
              placeholder="سعر العرض"
              aria-label="سعر العرض"
              onChange={(e) => set({ offerPrice: e.target.value })}
            />
            <input
              className={field}
              type="number"
              min={0}
              inputMode="numeric"
              value={row.offerQuantity}
              placeholder="كمية العرض"
              aria-label="كمية العرض"
              onChange={(e) => set({ offerQuantity: e.target.value })}
            />
            <input
              className={field}
              type="number"
              min={0}
              inputMode="numeric"
              value={row.bonusQuantity}
              placeholder="كمية البونص"
              aria-label="كمية البونص"
              onChange={(e) => set({ bonusQuantity: e.target.value })}
            />
          </div>

          <textarea
            className={`${field} resize-none`}
            rows={1}
            value={row.description}
            placeholder="الوصف"
            aria-label="الوصف"
            onChange={(e) => set({ description: e.target.value })}
          />

          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => onRemove(row.localId)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
            >
              <Trash2 size={13} aria-hidden /> إزالة
            </button>
            <button
              type="button"
              disabled={saving || row.upload !== 'done' || !row.name.trim()}
              onClick={() => onSave(row.localId)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
            >
              {created ? <Check size={13} aria-hidden /> : <Save size={13} aria-hidden />}
              {created ? 'تم الحفظ — تحديث' : 'حفظ'}
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

export const ImportTableRow = memo(ImportTableRowInner);
