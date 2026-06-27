/**
 * Storage service — local product image files + image processing.
 *
 * Full images live under   server/uploads/products/   and thumbnails under
 * server/uploads/thumbs/  ; both are served as static files at /uploads/...
 * (see app.ts @fastify/static, which serves the whole uploads base).
 *
 * Pipeline (Sharp): decode → auto-orient (EXIF) → strip metadata → WebP. The
 * full image is q82; a 400px thumbnail is q80. Files share one UUID name so the
 * thumbnail can be derived from the full URL (products/<id>.webp ↔ thumbs/<id>.webp),
 * which avoids any Product-model / DB-schema change.
 *
 * Validation (mime + magic bytes + size) and all filesystem work live here;
 * routes only orchestrate.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import sharp from 'sharp';

/** Base uploads dir served at /uploads, plus the products/thumbs subfolders + prefixes. */
export const UPLOADS_BASE = process.env.UPLOADS_BASE || resolve(process.cwd(), 'uploads');
export const PRODUCTS_DIR = process.env.UPLOADS_DIR || join(UPLOADS_BASE, 'products');
export const THUMBS_DIR = process.env.UPLOADS_THUMBS_DIR || join(UPLOADS_BASE, 'thumbs');
export const PUBLIC_PREFIX = process.env.UPLOADS_PUBLIC_PREFIX || '/uploads/products';
export const THUMBS_PREFIX = process.env.UPLOADS_THUMBS_PREFIX || '/uploads/thumbs';

/** Max upload size in bytes (default 50 MB — client compresses before sending). */
export const MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES) || 50 * 1024 * 1024;

/** Image processing parameters. */
const FULL_WEBP_QUALITY = 82;
const THUMB_MAX_PX = 400;
const THUMB_WEBP_QUALITY = 80;

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Production hardening — bound Sharp's peak memory under concurrent uploads.
 *
 * libvips holds the full RAW bitmap (width × height × channels) in memory while
 * it decodes + re-encodes an image, so the cost is set by input PIXELS, not the
 * compressed byte size: an 8800×6600 JPEG is ~166 MB raw. Without a cap the
 * server's peak RSS scales with the number of uploads in flight — measured here
 * at ~0.6 GB (1 image), ~3.0 GB (5 images), ~4.5 GB (8 images) — i.e. memory
 * would depend on client/load rather than on the server. The gate below makes
 * the worst case O(limit) instead of O(concurrent requests).
 *
 * Behaviour is unchanged: every upload is still processed identically (full q82
 * + 400px thumb, same bytes, same URLs, same 201). Under a burst larger than the
 * limit, the extra uploads simply queue for a moment instead of all decoding at
 * once. For the single-admin catalog this is effectively never hit in normal use
 * (the realistic 5×client-compressed workload peaks at ~0.6 GB regardless).
 */
const IMAGE_MAX_CONCURRENCY = Math.max(1, Number(process.env.IMAGE_MAX_CONCURRENCY) || 2);

/**
 * Disable the libvips operation cache. This server processes each upload exactly
 * once and never re-runs the same operation on the same pixels, so the cache only
 * retains memory with no hit-rate benefit. (Safe, idempotent, recommended for
 * one-shot processing services.)
 */
sharp.cache(false);

/**
 * Minimal counting semaphore. A released permit is handed straight to the next
 * waiter (or returned to the pool if none), so the active count can never exceed
 * `max` — no over-admission, no external dependency.
 */
class Semaphore {
  private permits: number;
  private readonly queue: Array<() => void> = [];
  constructor(max: number) {
    this.permits = max;
  }
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.permits > 0) {
      this.permits--;
    } else {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    try {
      return await fn();
    } finally {
      const next = this.queue.shift();
      if (next) next(); // hand the permit directly to the next waiter
      else this.permits++; // no waiter: return it to the pool
    }
  }
}

/** Gate that bounds how many images Sharp decodes/encodes at the same time. */
const imageGate = new Semaphore(IMAGE_MAX_CONCURRENCY);

/**
 * Verify the file's leading bytes (magic number) actually match an image type —
 * defends against a spoofed Content-Type / extension on an arbitrary payload.
 * (We never trust the file extension.)
 */
function sniffImageType(buf: Buffer): 'jpg' | 'png' | 'webp' | 'gif' | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'png';
  // GIF: "GIF87a" / "GIF89a"
  if (buf.toString('ascii', 0, 6).match(/^GIF8[79]a$/)) return 'gif';
  // WEBP: "RIFF"...."WEBP"
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/** Thrown for invalid uploads so routes can answer 400 (vs 500). */
export class UploadValidationError extends Error {}

export interface SavedImage {
  filename: string;
  /** Full image URL, stored as the product's imageUrl. */
  url: string;
  /** Thumbnail URL (derivable from `url`; returned for convenience). */
  thumbUrl: string;
  /** Stored (processed) full-image size in bytes. */
  bytes: number;
  /** Original upload size in bytes (before server WebP processing). */
  originalBytes: number;
}

export interface SaveImageInput {
  buffer: Buffer;
  mimetype: string;
  filename?: string;
}

export class StorageService {
  constructor() {
    // Ensure both target dirs exist (also needed by @fastify/static root).
    mkdirSync(PRODUCTS_DIR, { recursive: true });
    mkdirSync(THUMBS_DIR, { recursive: true });
  }

  /**
   * Validate + process + store an uploaded image. Returns the full + thumbnail
   * URLs. The output is always WebP with a unique UUID filename, so the original
   * is never overwritten.
   */
  async saveImage({ buffer, mimetype, filename }: SaveImageInput): Promise<SavedImage> {
    // 1) Cheap guards first.
    if (!buffer || buffer.length === 0) {
      throw new UploadValidationError('Empty file');
    }
    if (buffer.length > MAX_BYTES) {
      throw new UploadValidationError(
        `File too large (${buffer.length} bytes, max ${MAX_BYTES}).`,
      );
    }

    // 2) Never trust the extension — require a real image by magic bytes.
    //    (mimetype is informational only; the bytes are authoritative.)
    if (!sniffImageType(buffer)) {
      void mimetype; void filename;
      throw new UploadValidationError('File content is not a recognized image');
    }

    const startedAt = Date.now();
    const name = `${randomUUID()}.webp`;

    // 3) Process with Sharp: auto-orient from EXIF, then re-encode to WebP
    //    (re-encoding strips all metadata/EXIF). Decode failures => invalid image.
    let fullWebp: Buffer;
    let thumbWebp: Buffer;
    try {
      // Gate the Sharp work so peak memory stays bounded under concurrent uploads
      // (see IMAGE_MAX_CONCURRENCY above). The pipeline is otherwise unchanged.
      [fullWebp, thumbWebp] = await imageGate.run(async () => {
        const full = await sharp(buffer)
          .rotate() // normalize orientation using EXIF, then drop it on re-encode
          .webp({ quality: FULL_WEBP_QUALITY })
          .toBuffer();
        const thumb = await sharp(buffer)
          .rotate()
          .resize({ width: THUMB_MAX_PX, height: THUMB_MAX_PX, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: THUMB_WEBP_QUALITY })
          .toBuffer();
        return [full, thumb];
      });
    } catch {
      throw new UploadValidationError('Invalid or corrupt image data');
    }

    // 4) Persist (full + thumb share the UUID name).
    await writeFile(join(PRODUCTS_DIR, name), fullWebp);
    await writeFile(join(THUMBS_DIR, name), thumbWebp);

    if (isDev) {
      const ms = Date.now() - startedAt;
      const ratio = (fullWebp.length / buffer.length).toFixed(2);
      // eslint-disable-next-line no-console
      console.log(
        `[image] ${buffer.length}B -> full ${fullWebp.length}B (ratio ${ratio}) + thumb ${thumbWebp.length}B in ${ms}ms`,
      );
    }

    return {
      filename: name,
      url: `${PUBLIC_PREFIX}/${name}`,
      thumbUrl: `${THUMBS_PREFIX}/${name}`,
      bytes: fullWebp.length,
      originalBytes: buffer.length,
    };
  }

  /**
   * Delete a stored image (and its thumbnail) given the full image's local URL
   * (e.g. `/uploads/products/x.webp`). No-op for empty / remote / non-local URLs
   * or missing files. Returns true if the full image file was removed.
   */
  async deleteByUrl(url: string | null | undefined): Promise<boolean> {
    if (!url || typeof url !== 'string') return false;
    if (!url.startsWith(PUBLIC_PREFIX)) return false; // not a local upload
    const name = basename(url); // strips any path traversal
    if (!name) return false;

    // Remove the thumbnail too (best-effort; it may not exist for older images).
    const thumbPath = join(THUMBS_DIR, name);
    if (existsSync(thumbPath)) {
      try { await unlink(thumbPath); } catch { /* best-effort */ }
    }

    const fsPath = join(PRODUCTS_DIR, name);
    if (!existsSync(fsPath)) return false;
    try {
      await unlink(fsPath);
      return true;
    } catch {
      return false;
    }
  }
}
