/**
 * SettingsService — catalog-wide settings owned by the administrator.
 *
 * Key/value rows (JSON-encoded values) in the `settings` table, merged over
 * typed defaults so a fresh database behaves like the app always has:
 *
 *   showPrices             boolean  whether prices are available in the catalog
 *   allowRepPriceToggle    boolean  may representatives hide/show prices themselves
 *   defaultProductImageUrl string   image shown for products without their own
 *   company*               string   single Company Profile (name, tagline, phone,
 *                                    whatsapp, email, website, address) — the one
 *                                    source of company identity, reused everywhere
 *                                    (catalog header, presentations, …).
 *
 * Follows the ProductsService pattern: this is the ONLY place that touches the
 * settings table — routes contain no SQL.
 */
import type { DatabaseSync } from 'node:sqlite';

export interface CatalogSettings {
  showPrices: boolean;
  allowRepPriceToggle: boolean;
  defaultProductImageUrl: string;
  companyName: string;
  companyTagline: string;
  companyPhone: string;
  companyWhatsapp: string;
  companyEmail: string;
  companyWebsite: string;
  companyAddress: string;
}

export const SETTINGS_DEFAULTS: CatalogSettings = {
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

const KEYS = Object.keys(SETTINGS_DEFAULTS) as (keyof CatalogSettings)[];
/** Keys whose value is a boolean; everything else is coerced to string. */
const BOOLEAN_KEYS = new Set<keyof CatalogSettings>(['showPrices', 'allowRepPriceToggle']);

export class SettingsService {
  constructor(private readonly db: DatabaseSync) {}

  getAll(): CatalogSettings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as {
      key: string;
      value: string;
    }[];
    const result: CatalogSettings = { ...SETTINGS_DEFAULTS };
    for (const row of rows) {
      const key = row.key as keyof CatalogSettings;
      if (!KEYS.includes(key)) continue;
      try {
        const parsed = JSON.parse(row.value);
        if (BOOLEAN_KEYS.has(key)) {
          (result[key] as boolean) = Boolean(parsed);
        } else {
          (result[key] as string) = String(parsed ?? '');
        }
      } catch {
        /* ignore malformed rows — defaults win */
      }
    }
    return result;
  }

  update(patch: Partial<CatalogSettings>): CatalogSettings {
    const upsert = this.db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    );
    for (const key of KEYS) {
      if (key in patch) upsert.run(key, JSON.stringify(patch[key]));
    }
    return this.getAll();
  }
}
