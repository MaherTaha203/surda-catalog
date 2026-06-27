/**
 * Data migration — Blink → SQLite + local image store.
 *
 * Run with `npm run migrate` (repo root) or `npm run migrate` (in server/).
 *
 * What it does:
 *   1. Reads EVERY product from Blink (primary source) — same projectId/key as
 *      the frontend (src/blink/client.ts).
 *   2. Upserts each product into SQLite by `id` (insert or update) — preserving
 *      the id and every field value exactly.
 *   3. Downloads each product image into  server/uploads/products/  and rewrites
 *      `imageUrl` to the local server path  /uploads/products/<file>.
 *   4. Prints a summary (products migrated / images downloaded / skipped).
 *
 * Idempotent: products upsert by primary key (no duplicates); images are skipped
 * when the local file already exists. Running it twice changes nothing.
 *
 * Blink is only READ — never modified — so Blink keeps working untouched.
 *
 * Offline / backup source (optional): set MIGRATE_SOURCE_FILE to a JSON file
 * containing an array of products (e.g. a src/lib/backup.ts export) to migrate
 * from that instead of calling Blink. Useful where Blink egress is blocked.
 */
import { createClient } from '@blinkdotnew/sdk';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { initDatabase } from './database/index.ts';
import { ProductsService, type ProductRow } from './services/products.ts';

// ── Config ──────────────────────────────────────────────────────────────────

const BLINK_PROJECT_ID =
  process.env.VITE_BLINK_PROJECT_ID || 'sarda-catalog-pwa-k9uwa31b';
const BLINK_PUBLISHABLE_KEY =
  process.env.VITE_BLINK_PUBLISHABLE_KEY ||
  'blnk_pk_LAo3tJRyVH6jJyR3B7UJzL6as8bKYAyz';

/** Where downloaded images are stored on disk. */
const UPLOADS_DIR =
  process.env.UPLOADS_DIR || resolve(process.cwd(), 'uploads', 'products');

/** Public path prefix written into `imageUrl` (served by the API later). */
const PUBLIC_PREFIX = process.env.UPLOADS_PUBLIC_PREFIX || '/uploads/products';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Coerce a raw Blink/JSON record into a typed ProductRow (preserving values). */
function normalize(raw: Record<string, unknown>): ProductRow {
  const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
  const int = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  };
  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    id: str(raw.id),
    name: str(raw.name),
    description: str(raw.description),
    size: str(raw.size),
    cartonQuantity: int(raw.cartonQuantity),
    cartonPrice: num(raw.cartonPrice),
    imageUrl: str(raw.imageUrl),
    category: str(raw.category),
    isHidden: int(raw.isHidden),
    sortOrder: int(raw.sortOrder),
    createdAt: str(raw.createdAt),
    updatedAt: str(raw.updatedAt),
  };
}

/** Deterministic file extension from a URL path (defaults to jpg). */
function extFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    const m = pathname.match(/\.([a-zA-Z0-9]{1,5})$/);
    if (m) return m[1].toLowerCase();
  } catch {
    /* fall through */
  }
  return 'jpg';
}

/** Filesystem-safe version of a product id for use as a filename. */
function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/** Read products from Blink, or from MIGRATE_SOURCE_FILE when set. */
async function readProducts(): Promise<ProductRow[]> {
  const sourceFile = process.env.MIGRATE_SOURCE_FILE;
  if (sourceFile) {
    console.log(`Reading products from file: ${sourceFile}`);
    const text = await readFile(sourceFile, 'utf8');
    const parsed = JSON.parse(text);
    const arr: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { products?: unknown[] }).products)
        ? (parsed as { products: unknown[] }).products
        : [];
    return arr.map((r) => normalize(r as Record<string, unknown>));
  }

  console.log(`Reading products from Blink project: ${BLINK_PROJECT_ID}`);
  const blink = createClient({
    projectId: BLINK_PROJECT_ID,
    publishableKey: BLINK_PUBLISHABLE_KEY,
    authRequired: false,
    auth: { mode: 'managed' },
  });
  const items = await blink.db
    .table('products')
    .list({ orderBy: { sortOrder: 'asc' } });
  return (items || []).map((r: Record<string, unknown>) => normalize(r));
}

// ── Migration ───────────────────────────────────────────────────────────────

async function migrate(): Promise<void> {
  let productsMigrated = 0;
  let imagesDownloaded = 0;
  let imagesSkipped = 0;
  let imageFailures = 0;

  const products = await readProducts();

  mkdirSync(UPLOADS_DIR, { recursive: true });
  const { db, dbPath, created } = initDatabase();
  console.log(`SQLite: ${dbPath}${created ? ' (created)' : ''}`);
  const service = new ProductsService(db);

  for (const product of products) {
    const remote = product.imageUrl;

    // Download + rewrite the image when it's a remote URL.
    if (remote && /^https?:\/\//i.test(remote)) {
      const filename = `${safeId(product.id)}.${extFromUrl(remote)}`;
      const fsPath = join(UPLOADS_DIR, filename);
      const publicPath = `${PUBLIC_PREFIX}/${filename}`;

      if (existsSync(fsPath)) {
        imagesSkipped++; // already downloaded — idempotent
        product.imageUrl = publicPath;
      } else {
        try {
          const res = await fetch(remote);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buf = Buffer.from(await res.arrayBuffer());
          await writeFile(fsPath, buf);
          imagesDownloaded++;
          product.imageUrl = publicPath;
        } catch (err) {
          imageFailures++;
          console.warn(
            `  ! image download failed for '${product.id}' (${remote}): ${(err as Error).message} — keeping original URL`,
          );
          // leave product.imageUrl as the remote URL so it still resolves
        }
      }
    } else if (remote && remote.startsWith(PUBLIC_PREFIX)) {
      // Already a local path (e.g. re-running from a migrated source) — skip.
      imagesSkipped++;
    }

    // Upsert preserves id + all field values; never duplicates.
    service.upsert(product);
    productsMigrated++;
  }

  db.close();

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n— Migration summary —');
  console.log(`Products migrated: ${productsMigrated}`);
  console.log(`Images downloaded: ${imagesDownloaded}`);
  console.log(`Skipped: ${imagesSkipped}`);
  if (imageFailures > 0) {
    console.log(`Image download failures: ${imageFailures}`);
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nMigration failed:', err?.message || err);
    if (typeof err?.status !== 'undefined') {
      console.error(`(Blink responded ${err.status}.)`);
    }
    process.exit(1);
  });
