/**
 * Media Management service (v1.1).
 *
 * An operational layer ON TOP of the existing image system — it does NOT change
 * how images are uploaded or processed. It cross-references the `products` table
 * (the source of truth for which images are in use) against the files actually on
 * disk under uploads/products and uploads/thumbs, and reports/repairs drift.
 *
 * Design rules honoured:
 *   - No schema change: "in use" is derived from products.imageUrl, exactly as the
 *     rest of the app already interprets it (StorageService.deleteByUrl).
 *   - Read-only by default: every report is a pure scan. The only mutations are
 *     the explicit `collectGarbage({ execute: true })` and `regenerateThumbnails`.
 *   - Single source of truth for the image pipeline: thumbnail repair calls
 *     StorageService.regenerateThumbnail (same Sharp params, same memory gate).
 *
 * Naming convention (unchanged from the upload engine): a product's full image is
 * `/uploads/products/<name>` and its thumbnail is `/uploads/thumbs/<name>` — the
 * same basename in both folders.
 */
import { readdir, stat, readFile, unlink, open } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { ProductsService } from './products.ts';
import {
  StorageService,
  PRODUCTS_DIR,
  THUMBS_DIR,
  PUBLIC_PREFIX,
  THUMBS_PREFIX,
  sniffImageType,
  getImageMetrics,
} from './storage.ts';

// ── Report shapes ────────────────────────────────────────────────────────────

export interface GarbageReport {
  scannedAt: string;
  counts: { products: number; referencedImages: number; fullFiles: number; thumbFiles: number };
  /** Files on disk that no product references — safe to delete. */
  orphans: { full: string[]; thumbs: string[] };
  /** Images a product references that are absent on disk — cannot be deleted, need attention. */
  missing: { full: string[]; thumbs: string[] };
  /** Full/thumb pairs that don't line up (one side present, the other absent). */
  mismatched: { fullWithoutThumb: string[]; thumbWithoutFull: string[] };
  /** Total bytes that the orphan files occupy (reclaimable on execute). */
  reclaimableBytes: number;
}

export interface GarbageResult {
  executed: boolean;
  deleted: { full: string[]; thumbs: string[] };
  freedBytes: number;
  report: GarbageReport;
}

export interface IntegrityIssue {
  name: string;
  fullExists: boolean;
  thumbExists: boolean;
  readable: boolean;
  decodable: boolean;
  extensionMatches: boolean;
  referencedBy: number;
  problems: string[];
}

export interface IntegrityReport {
  scannedAt: string;
  checked: number;
  healthy: number;
  issues: IntegrityIssue[];
}

export interface DuplicateGroup {
  sha256: string;
  bytes: number;
  files: string[];
  /** How many products reference any file in this group. */
  referencedBy: number;
}

export interface DuplicateReport {
  scannedAt: string;
  totalFiles: number;
  uniqueImages: number;
  duplicateGroups: DuplicateGroup[];
  duplicateFiles: number;
  wastedBytes: number;
}

export interface RegenReport {
  mode: 'missing' | 'all';
  candidates: number;
  regenerated: string[];
  failed: { name: string; error: string }[];
  bytesWritten: number;
  elapsedMs: number;
}

export interface MediaStats {
  collectedAt: string;
  images: { count: number; totalBytes: number; avgBytes: number; largest: { name: string; bytes: number } | null };
  thumbnails: { count: number; totalBytes: number; avgBytes: number };
  totalBytes: number;
  fileTypes: Record<string, number>;
  references: { products: number; withLocalImage: number; withoutImage: number; missingOnDisk: number };
  /** In-process processing metrics since server start (Observability). */
  processing: ReturnType<typeof getImageMetrics>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** List stored image files in a dir (ignores dotfiles / .gitkeep / non-files). */
async function listImageFiles(dir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return []; // dir may not exist yet
  }
  return entries.filter((f) => !f.startsWith('.') && f.toLowerCase().endsWith('.webp'));
}

/** Set difference a \ b. */
const diff = (a: Iterable<string>, b: Set<string>): string[] => [...a].filter((x) => !b.has(x));

export class MediaService {
  private readonly storage: StorageService;

  constructor(
    private readonly products: ProductsService,
    storage?: StorageService,
  ) {
    this.storage = storage ?? new StorageService();
  }

  /** Basenames of full images that products currently reference (local uploads only). */
  private referencedNames(): Set<string> {
    const names = new Set<string>();
    for (const p of this.products.list()) {
      const url = p.imageUrl;
      if (typeof url === 'string' && url.startsWith(`${PUBLIC_PREFIX}/`)) {
        names.add(basename(url));
      }
    }
    return names;
  }

  // ── Phase 1: Garbage Collection ────────────────────────────────────────────

  /** Dry-run scan: classify every file/reference. Deletes nothing. */
  async scanGarbage(): Promise<GarbageReport> {
    const referenced = this.referencedNames();
    const fullFiles = await listImageFiles(PRODUCTS_DIR);
    const thumbFiles = await listImageFiles(THUMBS_DIR);
    const fullSet = new Set(fullFiles);
    const thumbSet = new Set(thumbFiles);

    const orphanFull = diff(fullFiles, referenced);
    const orphanThumb = diff(thumbFiles, referenced);
    const missingFull = diff(referenced, fullSet);
    const missingThumb = diff(referenced, thumbSet);
    const fullWithoutThumb = diff(fullFiles, thumbSet);
    const thumbWithoutFull = diff(thumbFiles, fullSet);

    // Bytes reclaimable by deleting orphans.
    let reclaimableBytes = 0;
    for (const f of orphanFull) reclaimableBytes += await fileSize(join(PRODUCTS_DIR, f));
    for (const f of orphanThumb) reclaimableBytes += await fileSize(join(THUMBS_DIR, f));

    return {
      scannedAt: new Date().toISOString(),
      counts: {
        products: this.products.count(),
        referencedImages: referenced.size,
        fullFiles: fullFiles.length,
        thumbFiles: thumbFiles.length,
      },
      orphans: { full: orphanFull.sort(), thumbs: orphanThumb.sort() },
      missing: { full: missingFull.sort(), thumbs: missingThumb.sort() },
      mismatched: { fullWithoutThumb: fullWithoutThumb.sort(), thumbWithoutFull: thumbWithoutFull.sort() },
      reclaimableBytes,
    };
  }

  /**
   * Collect garbage. With `execute: false` (default) this is identical to
   * scanGarbage wrapped in a result envelope — nothing is removed. With
   * `execute: true` it deletes ONLY orphan files (never a referenced image).
   */
  async collectGarbage({ execute = false }: { execute?: boolean } = {}): Promise<GarbageResult> {
    const report = await this.scanGarbage();
    if (!execute) {
      return { executed: false, deleted: { full: [], thumbs: [] }, freedBytes: 0, report };
    }
    let freed = 0;
    const deletedFull: string[] = [];
    const deletedThumb: string[] = [];
    for (const f of report.orphans.full) {
      const path = join(PRODUCTS_DIR, f);
      const size = await fileSize(path);
      if (await safeUnlink(path)) { deletedFull.push(f); freed += size; }
    }
    for (const f of report.orphans.thumbs) {
      const path = join(THUMBS_DIR, f);
      const size = await fileSize(path);
      if (await safeUnlink(path)) { deletedThumb.push(f); freed += size; }
    }
    return { executed: true, deleted: { full: deletedFull, thumbs: deletedThumb }, freedBytes: freed, report };
  }

  // ── Phase 2: Image Integrity ───────────────────────────────────────────────

  /**
   * Verify each referenced image: full present, thumb present, file readable,
   * pixels decodable (not corrupt), and the magic bytes match the .webp extension.
   */
  async checkIntegrity(): Promise<IntegrityReport> {
    const referenced = this.referencedNames();
    const refCounts = this.referenceCounts();
    const issues: IntegrityIssue[] = [];
    let healthy = 0;

    for (const name of referenced) {
      const fullPath = join(PRODUCTS_DIR, name);
      const thumbPath = join(THUMBS_DIR, name);
      const fullExists = await exists(fullPath);
      const thumbExists = await exists(thumbPath);

      let readable = false;
      let decodable = false;
      let extensionMatches = false;
      const problems: string[] = [];

      if (!fullExists) problems.push('full image missing on disk');
      if (!thumbExists) problems.push('thumbnail missing on disk');

      if (fullExists) {
        let buf: Buffer | null = null;
        try {
          buf = await readFile(fullPath);
          readable = true;
        } catch {
          problems.push('full image not readable');
        }
        if (buf) {
          // extension/type match: stored files are .webp, magic bytes must say webp
          extensionMatches = extname(name).toLowerCase() === '.webp' && sniffImageType(buf) === 'webp';
          if (!extensionMatches) problems.push('extension/content type mismatch');
          try {
            const meta = await sharp(buf).metadata();
            decodable = Boolean(meta.width && meta.height);
            if (!decodable) problems.push('image has no decodable dimensions');
          } catch {
            problems.push('image is corrupt (decode failed)');
          }
        }
      }

      if (problems.length === 0) {
        healthy++;
      } else {
        issues.push({
          name,
          fullExists,
          thumbExists,
          readable,
          decodable,
          extensionMatches,
          referencedBy: refCounts.get(name) ?? 0,
          problems,
        });
      }
    }

    return {
      scannedAt: new Date().toISOString(),
      checked: referenced.size,
      healthy,
      issues: issues.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  // ── Phase 3: Duplicate Detection ───────────────────────────────────────────

  /** SHA-256 every full image and group identical bytes. Reports only. */
  async findDuplicates(): Promise<DuplicateReport> {
    const fullFiles = await listImageFiles(PRODUCTS_DIR);
    const refCounts = this.referenceCounts();
    const byHash = new Map<string, { files: string[]; bytes: number }>();

    for (const name of fullFiles) {
      const path = join(PRODUCTS_DIR, name);
      let buf: Buffer;
      try {
        buf = await readFile(path);
      } catch {
        continue; // unreadable file — integrity check surfaces it
      }
      const hash = createHash('sha256').update(buf).digest('hex');
      const entry = byHash.get(hash);
      if (entry) entry.files.push(name);
      else byHash.set(hash, { files: [name], bytes: buf.length });
    }

    const duplicateGroups: DuplicateGroup[] = [];
    let duplicateFiles = 0;
    let wastedBytes = 0;
    for (const [sha256, { files, bytes }] of byHash) {
      if (files.length > 1) {
        const referencedBy = files.reduce((n, f) => n + (refCounts.get(f) ?? 0), 0);
        duplicateGroups.push({ sha256, bytes, files: files.sort(), referencedBy });
        duplicateFiles += files.length - 1; // all but one copy are redundant
        wastedBytes += bytes * (files.length - 1);
      }
    }
    duplicateGroups.sort((a, b) => b.files.length - a.files.length);

    return {
      scannedAt: new Date().toISOString(),
      totalFiles: fullFiles.length,
      uniqueImages: byHash.size,
      duplicateGroups,
      duplicateFiles,
      wastedBytes,
    };
  }

  // ── Phase 4: Thumbnail Regeneration ────────────────────────────────────────

  /**
   * Regenerate thumbnails from the full images. `mode: 'missing'` only fills in
   * thumbnails that are absent (repair / recover); `mode: 'all'` rebuilds every
   * thumbnail (e.g. after a future thumbnail-size change). Bounded by the same
   * Sharp concurrency gate as uploads.
   */
  async regenerateThumbnails({ mode = 'missing' }: { mode?: 'missing' | 'all' } = {}): Promise<RegenReport> {
    const startedAt = Date.now();
    const fullFiles = await listImageFiles(PRODUCTS_DIR);
    const thumbSet = new Set(await listImageFiles(THUMBS_DIR));
    const candidates = mode === 'all' ? fullFiles : fullFiles.filter((f) => !thumbSet.has(f));

    const regenerated: string[] = [];
    const failed: { name: string; error: string }[] = [];
    let bytesWritten = 0;

    // The gate inside StorageService bounds memory; we can fan these out.
    await Promise.all(
      candidates.map(async (name) => {
        try {
          const { bytes } = await this.storage.regenerateThumbnail(name);
          regenerated.push(name);
          bytesWritten += bytes;
        } catch (err) {
          failed.push({ name, error: err instanceof Error ? err.message : String(err) });
        }
      }),
    );

    return {
      mode,
      candidates: candidates.length,
      regenerated: regenerated.sort(),
      failed: failed.sort((a, b) => a.name.localeCompare(b.name)),
      bytesWritten,
      elapsedMs: Date.now() - startedAt,
    };
  }

  // ── Phase 5: Observability ─────────────────────────────────────────────────

  /** Aggregate disk + reference + processing metrics for an admin dashboard. */
  async collectStats(): Promise<MediaStats> {
    const fullFiles = await listImageFiles(PRODUCTS_DIR);
    const thumbFiles = await listImageFiles(THUMBS_DIR);
    const referenced = this.referencedNames();
    const fullSet = new Set(fullFiles);

    let imageBytes = 0;
    let largest: { name: string; bytes: number } | null = null;
    const fileTypes: Record<string, number> = {};
    for (const name of fullFiles) {
      const path = join(PRODUCTS_DIR, name);
      const size = await fileSize(path);
      imageBytes += size;
      if (!largest || size > largest.bytes) largest = { name, bytes: size };
      // Detect the real stored format by magic bytes (all should be webp).
      const type = await fileType(path);
      fileTypes[type] = (fileTypes[type] ?? 0) + 1;
    }

    let thumbBytes = 0;
    for (const name of thumbFiles) thumbBytes += await fileSize(join(THUMBS_DIR, name));

    const all = this.products.list();
    const withLocalImage = referenced.size;
    const withoutImage = all.filter((p) => !p.imageUrl || !p.imageUrl.startsWith(`${PUBLIC_PREFIX}/`)).length;
    const missingOnDisk = diff(referenced, fullSet).length;

    return {
      collectedAt: new Date().toISOString(),
      images: {
        count: fullFiles.length,
        totalBytes: imageBytes,
        avgBytes: fullFiles.length ? Math.round(imageBytes / fullFiles.length) : 0,
        largest,
      },
      thumbnails: {
        count: thumbFiles.length,
        totalBytes: thumbBytes,
        avgBytes: thumbFiles.length ? Math.round(thumbBytes / thumbFiles.length) : 0,
      },
      totalBytes: imageBytes + thumbBytes,
      fileTypes,
      references: {
        products: all.length,
        withLocalImage,
        withoutImage,
        missingOnDisk,
      },
      processing: getImageMetrics(),
    };
  }

  // ── shared ────────────────────────────────────────────────────────────────

  /** Map of full-image basename -> number of products referencing it. */
  private referenceCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const p of this.products.list()) {
      const url = p.imageUrl;
      if (typeof url === 'string' && url.startsWith(`${PUBLIC_PREFIX}/`)) {
        const name = basename(url);
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return counts;
  }
}

// Module-level fs helpers (kept tiny + dependency-free).
async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch { return false; }
}
async function fileSize(path: string): Promise<number> {
  try { return (await stat(path)).size; } catch { return 0; }
}
async function safeUnlink(path: string): Promise<boolean> {
  try { await unlink(path); return true; } catch { return false; }
}
/** Sniff a file's image type by reading only its first 12 bytes (cheap at scale). */
async function fileType(path: string): Promise<string> {
  let fh;
  try {
    fh = await open(path, 'r');
    const buf = Buffer.alloc(12);
    await fh.read(buf, 0, 12, 0);
    return sniffImageType(buf) ?? 'unknown';
  } catch {
    return 'unreadable';
  } finally {
    await fh?.close().catch(() => {});
  }
}

// Re-export for callers that want the prefixes alongside the service.
export { PUBLIC_PREFIX, THUMBS_PREFIX };
