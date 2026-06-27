/**
 * Products service — foundation data-access for the `products` table.
 *
 * Prepared for the migration but intentionally NOT wired to any HTTP route yet
 * (this phase exposes only GET /health, and the frontend is not connected).
 * It mirrors the operations Blink provides today (PROJECT_AUDIT.md §5) so that a
 * later phase can back the Fastify `/products` endpoints with it unchanged.
 */
import type { DatabaseSync } from 'node:sqlite';

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
}
