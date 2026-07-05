/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible).
 *
 * Each delegate's browser gets one stable device id (localStorage), so the
 * manager can address notifications to a specific device — or broadcast to
 * every delegate with the reserved id 'all'. No devices table is added; the
 * spec allows only the single `notifications` table.
 */
const DEVICE_KEY = 'sarda_notif_device_id';

/** Small readable id: notif-XXXXXX (avoids needing crypto.randomUUID on SSR). */
function makeDeviceId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const stamp = Date.now().toString(36).slice(-4);
  return `dev-${stamp}${rand}`;
}

/** Get (creating + persisting on first call) this browser's delegate device id. */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'all';
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = makeDeviceId();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}
