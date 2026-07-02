/**
 * Database schema — the `products` table.
 *
 * Fields are EXACTLY the ones Blink uses today (see PROJECT_AUDIT.md §8 and the
 * `Product` interface in ../../../src/types/product.ts). No fields are invented.
 *
 *   id, name, description, size, cartonQuantity, cartonPrice, imageUrl,
 *   category, isHidden, sortOrder, createdAt, updatedAt
 *
 * Type mapping (preserving the current client contract):
 *   - cartonQuantity / isHidden / sortOrder → INTEGER  (isHidden: 0 = visible, 1 = hidden)
 *   - cartonPrice                           → REAL      (price may have decimals)
 *   - everything else                       → TEXT      (createdAt/updatedAt are ISO strings)
 */
export const PRODUCTS_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS products (
  id             TEXT    PRIMARY KEY,
  name           TEXT    NOT NULL,
  description    TEXT    NOT NULL DEFAULT '',
  size           TEXT    NOT NULL DEFAULT '',
  cartonQuantity INTEGER NOT NULL DEFAULT 0,
  cartonPrice    REAL    NOT NULL DEFAULT 0,
  offerPrice     REAL    NOT NULL DEFAULT 0,
  offerQuantity  INTEGER NOT NULL DEFAULT 0,
  bonusQuantity  INTEGER NOT NULL DEFAULT 0,
  imageUrl       TEXT    NOT NULL DEFAULT '',
  category       TEXT    NOT NULL,
  isHidden       INTEGER NOT NULL DEFAULT 0,
  sortOrder      INTEGER NOT NULL DEFAULT 0,
  createdAt      TEXT    NOT NULL,
  updatedAt      TEXT    NOT NULL
);
`;

/**
 * Default read order across the app is `sortOrder ASC` (every Blink `list` call
 * relies on it), so index that column — mirrors src/lib/offline-db.ts.
 */
export const PRODUCTS_INDEXES_DDL = `
CREATE INDEX IF NOT EXISTS idx_products_sortOrder ON products (sortOrder);
CREATE INDEX IF NOT EXISTS idx_products_category  ON products (category);
`;

/**
 * Columns added after the initial release. `CREATE TABLE IF NOT EXISTS` does not
 * alter existing databases, so init applies these with ALTER TABLE when missing.
 */
export const PRODUCTS_MIGRATION_COLUMNS: { name: string; ddl: string }[] = [
  { name: 'offerPrice', ddl: 'ALTER TABLE products ADD COLUMN offerPrice REAL NOT NULL DEFAULT 0' },
  { name: 'offerQuantity', ddl: 'ALTER TABLE products ADD COLUMN offerQuantity INTEGER NOT NULL DEFAULT 0' },
  { name: 'bonusQuantity', ddl: 'ALTER TABLE products ADD COLUMN bonusQuantity INTEGER NOT NULL DEFAULT 0' },
];
