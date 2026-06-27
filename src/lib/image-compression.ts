/**
 * Client-side image compression (browser-image-compression).
 *
 * Before upload, large photos are downscaled (longest side → 2000 px, aspect
 * preserved) and re-encoded to WebP at quality 0.82 in a Web Worker, so the
 * network only ever carries a small file. The server still re-processes every
 * upload (WebP + thumbnail), so this is purely a transfer optimization.
 *
 * - Accepts up to 50 MB input.
 * - Compresses JPEG / PNG / WebP.
 * - Skips recompression when the file is already ≈700 KB or smaller (or not a
 *   compressible type) — never visibly degrades already-small images.
 */
const SKIP_BELOW_BYTES = 700 * 1024;
const MAX_INPUT_BYTES = 50 * 1024 * 1024;
const COMPRESSIBLE = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

/** Thrown for client-side validation failures (shown to the admin as a toast). */
export class ImageValidationError extends Error {}

export type CompressProgress = (percent: number) => void;

export async function compressProductImage(
  file: File,
  onProgress?: CompressProgress,
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new ImageValidationError('الملف المحدد ليس صورة صالحة');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageValidationError('حجم الصورة يتجاوز الحد الأقصى (50 ميجابايت)');
  }

  // Small or non-compressible (e.g. GIF) → send as-is; the server still
  // produces a WebP + thumbnail.
  if (file.size <= SKIP_BELOW_BYTES || !COMPRESSIBLE.has(file.type)) {
    onProgress?.(100);
    return file;
  }

  // Dynamic import keeps the worker library out of the SSR/initial bundle.
  const { default: imageCompression } = await import('browser-image-compression');

  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let compressed: File;
  try {
    compressed = await imageCompression(file, {
      maxWidthOrHeight: 2000, // longest side, aspect ratio preserved
      useWebWorker: true, // off the main thread → no UI freeze
      fileType: 'image/webp',
      initialQuality: 0.82,
      // Generous cap so quality/dimensions drive the result rather than an
      // aggressive size target that would degrade the image.
      maxSizeMB: 50,
      onProgress: (p: number) => onProgress?.(p),
    });
  } catch {
    // If compression fails for any reason, fall back to the original file —
    // the server will still validate and process it.
    onProgress?.(100);
    return file;
  }

  if (import.meta.env.DEV) {
    const ms = Math.round(
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt,
    );
    const ratio = file.size > 0 ? (compressed.size / file.size).toFixed(2) : '—';
    // eslint-disable-next-line no-console
    console.log(
      `[compress] ${file.size}B -> ${compressed.size}B (ratio ${ratio}) in ${ms}ms`,
    );
  }

  // Never return a *larger* file than the original.
  return compressed.size < file.size ? compressed : file;
}
