/**
 * Catalog settings API client — admin-owned, catalog-wide settings served by
 * the Fastify backend (`settings` table). Read by every catalog visitor;
 * written only from the admin settings page.
 */
import { apiRequest, resolveImageUrl, toStoredImageUrl } from './client';

export interface CatalogSettings {
  /** Global switch: are prices available in the catalog at all? */
  showPrices: boolean;
  /** May representatives hide/show prices on their own devices? */
  allowRepPriceToggle: boolean;
  /** Image shown for products without their own image ('' = none). */
  defaultProductImageUrl: string;
  /** Company Profile — the single source of company identity, reused everywhere. */
  companyName: string;
  companyTagline: string;
  companyPhone: string;
  companyWhatsapp: string;
  companyEmail: string;
  companyWebsite: string;
  companyAddress: string;
}

export const CATALOG_SETTINGS_DEFAULTS: CatalogSettings = {
  showPrices: true,
  allowRepPriceToggle: true,
  defaultProductImageUrl: '',
  companyName: 'شركة سردا',
  companyTagline: 'للتجارة والصناعة',
  companyPhone: '',
  companyWhatsapp: '',
  companyEmail: '',
  companyWebsite: '',
  companyAddress: '',
};

/**
 * Last-known settings, cached on this device so a fresh page load applies the
 * admin's choices immediately (no flash of prices the admin has disabled) and
 * an offline catalog keeps the last synced behavior.
 */
const CACHE_KEY = 'sarda_catalog_settings';

export function readCachedCatalogSettings(): CatalogSettings {
  if (typeof window === 'undefined') return CATALOG_SETTINGS_DEFAULTS;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return CATALOG_SETTINGS_DEFAULTS;
    return { ...CATALOG_SETTINGS_DEFAULTS, ...(JSON.parse(raw) as Partial<CatalogSettings>) };
  } catch {
    return CATALOG_SETTINGS_DEFAULTS;
  }
}

function cacheCatalogSettings(s: CatalogSettings): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    /* private mode etc. — cache is best-effort */
  }
}

export async function getCatalogSettings(): Promise<CatalogSettings> {
  const s = await apiRequest<CatalogSettings>('/catalog-settings');
  const resolved = {
    ...CATALOG_SETTINGS_DEFAULTS,
    ...s,
    defaultProductImageUrl: s?.defaultProductImageUrl
      ? resolveImageUrl(s.defaultProductImageUrl)
      : '',
  };
  cacheCatalogSettings(resolved);
  return resolved;
}

export async function updateCatalogSettings(
  patch: Partial<CatalogSettings>,
): Promise<CatalogSettings> {
  const body: Record<string, unknown> = { ...patch };
  if (typeof body.defaultProductImageUrl === 'string') {
    body.defaultProductImageUrl = toStoredImageUrl(body.defaultProductImageUrl);
  }
  const s = await apiRequest<CatalogSettings>('/catalog-settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const resolved = {
    ...CATALOG_SETTINGS_DEFAULTS,
    ...s,
    defaultProductImageUrl: s?.defaultProductImageUrl
      ? resolveImageUrl(s.defaultProductImageUrl)
      : '',
  };
  cacheCatalogSettings(resolved);
  return resolved;
}
