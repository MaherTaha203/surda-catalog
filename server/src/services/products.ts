/**
 * Products service — foundation data-access for the `products` table.
 *
 * Prepared for the migration but intentionally NOT wired to any HTTP route yet
 * (this phase exposes only GET /health, and the frontend is not connected).
 * It mirrors the operations Blink provides today (PROJECT_AUDIT.md §5) so that a
 * later phase can back the Fastify `/products` endpoints with it unchanged.
 */
import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

/** Row shape == the `Product` contract in ../../../src/types/product.ts. */
export interface ProductRow {
  id: string;
  name: string;
  description: string;
  size: string;
  cartonQuantity: number;
  cartonPrice: number;
  imageUrl: string;
  category: string;
  isHidden: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Fields accepted when creating a product (server fills id/timestamps/defaults). */
export interface NewProduct {
  name: string;
  description?: string;
  size?: string;
  cartonQuantity?: number;
  cartonPrice?: number;
  imageUrl?: string;
  category: string;
  isHidden?: number;
  sortOrder?: number;
}

/** Fields that may be patched (id + createdAt are immutable; updatedAt is managed). */
export type ProductUpdate = Partial<Omit<ProductRow, 'id' | 'createdAt' | 'updatedAt'>>;

export class ProductsService {
  constructor(private readonly db: DatabaseSync) {}

  /** All products, ordered by sortOrder asc (matches every Blink list call). */
  list(): ProductRow[] {
    return this.db
      .prepare('SELECT * FROM products ORDER BY sortOrder ASC')
      .all() as unknown as ProductRow[];
  }

  /** One product by id, or null if not found. */
  get(id: string): ProductRow | null {
    const row = this.db
      .prepare('SELECT * FROM products WHERE id = ?')
      .get(id) as unknown as ProductRow | undefined;
    return row ?? null;
  }

  /** Number of products currently stored. */
  count(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM products')
      .get() as { n: number };
    return row.n;
  }

  /**
   * Insert a product, or update it in place when the `id` already exists.
   * Idempotent by primary key — running a migration twice never duplicates rows.
   * Preserves the `id` and writes every field exactly as provided.
   */
  upsert(p: ProductRow): void {
    this.db
      .prepare(
        `INSERT INTO products
           (id, name, description, size, cartonQuantity, cartonPrice, imageUrl,
            category, isHidden, sortOrder, createdAt, updatedAt)
         VALUES
           (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name           = excluded.name,
           description    = excluded.description,
           size           = excluded.size,
           cartonQuantity = excluded.cartonQuantity,
           cartonPrice    = excluded.cartonPrice,
           imageUrl       = excluded.imageUrl,
           category       = excluded.category,
           isHidden       = excluded.isHidden,
           sortOrder      = excluded.sortOrder,
           createdAt      = excluded.createdAt,
           updatedAt      = excluded.updatedAt`,
      )
      .run(
        p.id,
        p.name,
        p.description,
        p.size,
        p.cartonQuantity,
        p.cartonPrice,
        p.imageUrl,
        p.category,
        p.isHidden,
        p.sortOrder,
        p.createdAt,
        p.updatedAt,
      );
  }

  /**
   * Create a new product. The server generates the `id` and createdAt/updatedAt,
   * and applies the same defaults the Blink-backed admin used (empty strings,
   * zeroes, isHidden = 0). Returns the created row.
   */
  create(input: NewProduct): ProductRow {
    const now = new Date().toISOString();
    const row: ProductRow = {
      id: randomUUID(),
      name: input.name,
      description: input.description ?? '',
      size: input.size ?? '',
      cartonQuantity: input.cartonQuantity ?? 0,
      cartonPrice: input.cartonPrice ?? 0,
      imageUrl: input.imageUrl ?? '',
      category: input.category,
      isHidden: input.isHidden ?? 0,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    this.upsert(row);
    return row;
  }

  /**
   * Update an existing product's fields. Preserves `id` and `createdAt`, refreshes
   * `updatedAt`. Returns the updated row, or null when the id does not exist.
   */
  update(id: string, patch: ProductUpdate): ProductRow | null {
    const existing = this.get(id);
    if (!existing) return null;
    const merged: ProductRow = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.upsert(merged);
    return merged;
  }

  /** Delete a product by id. Returns true when a row was removed. */
  delete(id: string): boolean {
    const res = this.db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return Number(res.changes) > 0;
  }

  /** Set a product's visibility (0 = visible, 1 = hidden). */
  setVisibility(id: string, isHidden: number): ProductRow | null {
    return this.update(id, { isHidden });
  }

  /** Set a product's manual sort order. */
  setOrder(id: string, sortOrder: number): ProductRow | null {
    return this.update(id, { sortOrder });
  }
}
