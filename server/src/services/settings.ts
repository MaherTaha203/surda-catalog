/**
 * SettingsService — catalog-wide settings owned by the administrator.
 *
 * Key/value rows (JSON-encoded values) in the `settings` table, merged over
 * typed defaults so a fresh database behaves like the app always has:
 *
 *   showPrices             boolean  whether prices are available in the catalog
 *   defaultProductImageUrl string   image shown for products without their own
 *
 * Follows the ProductsService pattern: this is the ONLY place that touches the
 * settings table — routes contain no SQL.
 */
import type { DatabaseSync } from 'node:sqlite';

export interface CatalogSettings {
  showPrices: boolean;
  defaultProductImageUrl: string;
}

export const SETTINGS_DEFAULTS: CatalogSettings = {
  showPrices: true,
  defaultProductImageUrl: '',
};

const KEYS = Object.keys(SETTINGS_DEFAULTS) as (keyof CatalogSettings)[];

export class SettingsService {
  constructor(private readonly db: DatabaseSync) {}

  getAll(): CatalogSettings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as {
      key: string;
      value: string;
    }[];
    const result: CatalogSettings = { ...SETTINGS_DEFAULTS };
    for (const row of rows) {
      if (!KEYS.includes(row.key as keyof CatalogSettings)) continue;
      try {
        const parsed = JSON.parse(row.value);
        if (row.key === 'showPrices') result.showPrices = Boolean(parsed);
        if (row.key === 'defaultProductImageUrl') result.defaultProductImageUrl = String(parsed ?? '');
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
