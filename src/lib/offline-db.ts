import type { Product } from '@/types/product';

/**
 * Local product snapshot — the "last known catalog", kept on the device so the
 * app can paint products on the FIRST frame, before (and without waiting for)
 * any network request. This is the heart of the local-first startup.
 *
 * Why localStorage (synchronous) instead of IndexedDB (async): the catalog is a
 * few hundred text rows (image URLs only — the images themselves live in the
 * browser/Service-Worker HTTP cache), which is a tiny payload well within the
 * localStorage budget. A synchronous read lets react-query seed `initialData`
 * on the very first render, so there is no async gap and no seed-vs-network
 * race — the catalog is simply there. Writes are best-effort (wrapped) so a
 * full or unavailable store never breaks the catalog.
 */
const SNAPSHOT_KEY = 'sarda_products_snapshot';
const SYNCED_AT_KEY = 'sarda_products_synced_at';

interface Snapshot {
  products: Product[];
  syncedAt: number;
}

/** Read the last saved catalog snapshot (sorted in the admin's order). */
export function readProductsSnapshot(): Product[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Snapshot | Product[];
    // Tolerate either the envelope or a bare array (forward/backward safe).
    const products = Array.isArray(parsed) ? parsed : parsed.products;
    if (!Array.isArray(products)) return [];
    // getAll()-style stores don't guarantee order; restore the admin's catalog
    // order so the offline catalog matches the online one.
    return [...products].sort((a, b) => a.sortOrder - b.sortOrder);
  } catch {
    return [];
  }
}

/** Persist the freshly fetched catalog + the moment it was synced. */
export function writeProductsSnapshot(products: Product[]): void {
  if (typeof window === 'undefined') return;
  const syncedAt = Date.now();
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ products, syncedAt } satisfies Snapshot));
    localStorage.setItem(SYNCED_AT_KEY, String(syncedAt));
  } catch {
    // Storage full or unavailable (private mode) — the in-memory query data
    // still serves this session; we simply skip persisting for the next one.
  }
}

/** Epoch millis of the last successful sync, or null if never synced. */
export function getLastSyncedAt(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SYNCED_AT_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
