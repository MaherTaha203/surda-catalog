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
}
