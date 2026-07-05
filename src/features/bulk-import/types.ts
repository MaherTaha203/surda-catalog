/**
 * Bulk image import — shared row model + helpers.
 *
 * One `ImportRow` per uploaded image. The image is uploaded once (Phase 1) and
 * its stored URL is reused for every save — the admin never re-uploads while
 * filling in fields (Phase 2 / quick entry).
 */
import type { Product, ProductCategory } from '@/types/product';

export const CATEGORY_OPTIONS: ProductCategory[] = ['مواد التنظيف', 'أدوات التنظيف'];
export const DEFAULT_CATEGORY: ProductCategory = 'مواد التنظيف';
/** Only "cleaning materials" carry a size (mirrors AdminProductForm). */
export const CATEGORY_WITH_SIZE: ProductCategory = 'مواد التنظيف';

export type UploadState = 'pending' | 'uploading' | 'done' | 'error';

export interface ImportRow {
  localId: string;
  file?: File;
  fileName: string;
  /** Instant local preview (object URL); revoked on unmount. */
  previewUrl: string;
  /** Stored, relative image URL once uploaded. */
  imageUrl: string;
  upload: UploadState;
  uploadError?: string;

  // Editable fields (kept as strings for controlled inputs).
  name: string;
  category: ProductCategory;
  size: string;
  cartonPrice: string;
  offerPrice: string;
  offerQuantity: string;
  bonusQuantity: string;
  description: string;

  /** Product id once created (as a draft in quick mode, or live in table mode). */
  createdId: string | null;
  /** True once its draft has been published to the catalog (quick mode). */
  published: boolean;
  /** Last successful autosave (quick mode) — drives the "saved" tick. */
  savedAt: number | null;
}

const numOr0 = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const intOr0 = (v: string): number => Math.max(0, Math.trunc(numOr0(v)));

/** Build the create/update payload for one row (size cleared for tool category). */
export function rowToPayload(row: ImportRow, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: row.name.trim(),
    category: row.category,
    size: row.category === CATEGORY_WITH_SIZE ? row.size.trim() : '',
    description: row.description.trim(),
    cartonPrice: numOr0(row.cartonPrice),
    offerPrice: numOr0(row.offerPrice),
    offerQuantity: intOr0(row.offerQuantity),
    bonusQuantity: intOr0(row.bonusQuantity),
    imageUrl: row.imageUrl,
    ...extra,
  };
}

/** A row is "complete" once it has a name and a carton price (drives progress). */
export function isRowComplete(row: ImportRow): boolean {
  return row.name.trim().length > 0 && numOr0(row.cartonPrice) > 0;
}

/** Seed the editable fields of a fresh row from an existing product (unused today). */
export function rowFromProduct(p: Product): Partial<ImportRow> {
  return {
    name: p.name,
    category: p.category,
    size: p.size,
    cartonPrice: String(p.cartonPrice || ''),
    offerPrice: String(p.offerPrice || ''),
    offerQuantity: String(p.offerQuantity || ''),
    bonusQuantity: String(p.bonusQuantity || ''),
    description: p.description,
  };
}
