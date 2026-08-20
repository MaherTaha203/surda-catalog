import { useCallback, useEffect, useState } from 'react';

/**
 * Walks an ordered list of image URLs (preferred → fallback), advancing to the
 * next one each time the current `<img>` fails to load. When every candidate has
 * failed, `exhausted` is true and the caller renders a clean placeholder instead
 * of the browser's broken-image marker.
 *
 *   const { src, onError, exhausted } = useImageFallback(fullImageCandidates(url));
 *   return exhausted ? <Placeholder/> : <img src={src} onError={onError} … />;
 *
 * Reliability only — it never re-downloads anything the browser/SW already has;
 * the fallback URL (a thumbnail) is normally already cached by the grid.
 */
export function useImageFallback(candidates: string[]): {
  src: string;
  onError: () => void;
  exhausted: boolean;
} {
  const [index, setIndex] = useState(0);
  // Reset when the candidate set changes (e.g. navigating to another product).
  const key = candidates.join('|');
  useEffect(() => {
    setIndex(0);
  }, [key]);

  const onError = useCallback(() => setIndex((i) => i + 1), []);
  const exhausted = candidates.length === 0 || index >= candidates.length;

  return { src: exhausted ? '' : candidates[index], onError, exhausted };
}
