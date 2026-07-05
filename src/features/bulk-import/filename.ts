/**
 * Bulk image import — helpers.
 *
 * Suggest a product name from an image filename so the admin rarely types it:
 *   "Crystal Bleach 4L.webp" → "Crystal Bleach 4L"
 *   "كلور 4 لتر.jpg"          → "كلور 4 لتر"
 * The result is always editable before saving.
 */

/** Derive a clean, editable product name from an uploaded file's name. */
export function suggestNameFromFilename(filename: string): string {
  return filename
    .replace(/^.*[\\/]/, '') // drop any path segment
    .replace(/\.[^.\s]+$/, '') // drop the extension (last .ext with no spaces)
    .replace(/[_]+/g, ' ') // underscores → spaces (dashes are kept — often intentional)
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
}

/**
 * Run an async worker over `items` with at most `limit` in flight — used to
 * upload hundreds of images without opening hundreds of parallel connections.
 * `onSettled(index)` fires after each item finishes (ok or error).
 */
export async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const size = Math.max(1, Math.min(limit, items.length));
  const runners = Array.from({ length: size }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}
