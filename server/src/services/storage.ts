/**
 * Storage service — local product image files.
 *
 * Images live under  server/uploads/products/  and are served by the API as
 * static files at  /uploads/products/<file>  (see app.ts @fastify/static).
 *
 * Responsibilities: validate (mime / extension / size), write with a unique
 * filename, return the local URL, and delete files (on replace / product delete).
 * All filesystem logic lives here — routes call this service.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

/** Base uploads dir served at /uploads, and the products subfolder + public prefix. */
export const UPLOADS_BASE = process.env.UPLOADS_BASE || resolve(process.cwd(), 'uploads');
export const PRODUCTS_DIR = process.env.UPLOADS_DIR || join(UPLOADS_BASE, 'products');
export const PUBLIC_PREFIX = process.env.UPLOADS_PUBLIC_PREFIX || '/uploads/products';

/** Max upload size in bytes (default 5 MB). */
export const MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES) || 5 * 1024 * 1024;

/** Allowed image mime types → canonical stored extension. */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
/** Allowed source-file extensions (validated against the original filename). */
const ALLOWED_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

/**
 * Verify the file's leading bytes (magic number) actually match an image type —
 * defends against a spoofed Content-Type / extension on an arbitrary payload.
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
  url: string;
  bytes: number;
}

export interface SaveImageInput {
  buffer: Buffer;
  mimetype: string;
  filename?: string;
}

export class StorageService {
  constructor() {
    // Ensure the target directory exists (also needed by @fastify/static root).
    mkdirSync(PRODUCTS_DIR, { recursive: true });
  }

  /** Validate + store an uploaded image, returning its local URL. */
  async saveImage({ buffer, mimetype, filename }: SaveImageInput): Promise<SavedImage> {
    const ext = MIME_TO_EXT[(mimetype || '').toLowerCase()];
    if (!ext) {
      throw new UploadValidationError(
        `Unsupported image type '${mimetype}'. Allowed: ${Object.keys(MIME_TO_EXT).join(', ')}`,
      );
    }

    // Validate the original file extension too (defense in depth).
    const srcExt = (filename?.split('.').pop() || '').toLowerCase();
    if (srcExt && !ALLOWED_EXTS.has(srcExt)) {
      throw new UploadValidationError(`Unsupported file extension '.${srcExt}'`);
    }

    if (!buffer || buffer.length === 0) {
      throw new UploadValidationError('Empty file');
    }
    if (buffer.length > MAX_BYTES) {
      throw new UploadValidationError(
        `File too large (${buffer.length} bytes, max ${MAX_BYTES}).`,
      );
    }

    // Content sniffing: the bytes must actually be an image (not just a spoofed
    // Content-Type / extension on an arbitrary payload).
    const sniffed = sniffImageType(buffer);
    if (!sniffed) {
      throw new UploadValidationError('File content is not a recognized image');
    }

    const name = `${randomUUID()}.${ext}`;
    await writeFile(join(PRODUCTS_DIR, name), buffer);
    return { filename: name, url: `${PUBLIC_PREFIX}/${name}`, bytes: buffer.length };
  }

  /**
   * Delete a previously stored image given its local URL (e.g. `/uploads/products/x.png`).
   * No-op for empty / remote / non-local URLs or a missing file. Returns true if deleted.
   */
  async deleteByUrl(url: string | null | undefined): Promise<boolean> {
    if (!url || typeof url !== 'string') return false;
    if (!url.startsWith(PUBLIC_PREFIX)) return false; // not a local upload
    const name = basename(url); // strips any path traversal
    if (!name) return false;
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
