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
      fullWebp = await sharp(buffer)
        .rotate() // normalize orientation using EXIF, then drop it on re-encode
        .webp({ quality: FULL_WEBP_QUALITY })
        .toBuffer();
      thumbWebp = await sharp(buffer)
        .rotate()
        .resize({ width: THUMB_MAX_PX, height: THUMB_MAX_PX, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: THUMB_WEBP_QUALITY })
        .toBuffer();
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
