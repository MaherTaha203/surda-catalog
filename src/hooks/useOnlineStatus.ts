import { useEffect, useState } from 'react';

/**
 * Tracks the browser's online/offline state via the `online`/`offline` events.
 * SSR-safe: renders as "online" on the server and the first client frame (so it
 * never causes a hydration mismatch), then syncs to the real value on mount.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update(); // sync in case it changed before this effect ran
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}
