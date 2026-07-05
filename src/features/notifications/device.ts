/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * Each delegate browser has one stable device_id (localStorage) plus a friendly
 * device_name the rep sets once (spec §21). The name is stored locally AND
 * registered on the server so the manager's "send to" dropdown can list devices
 * and read/completion tracking can show a name (spec §2, §6, §7).
 */
const DEVICE_ID_KEY = 'sarda_notif_device_id';
const DEVICE_NAME_KEY = 'sarda_notif_device_name';

function makeDeviceId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const stamp = Date.now().toString(36).slice(-4);
  return `dev-${stamp}${rand}`;
}

/** Get (creating + persisting on first call) this browser's device_id. */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return ALL_DEVICE_FALLBACK;
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = makeDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

const ALL_DEVICE_FALLBACK = 'all';

/** The rep's chosen device name, or '' if not set yet. */
export function getDeviceName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(DEVICE_NAME_KEY) || '';
}

export function setDeviceNameLocal(name: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEVICE_NAME_KEY, name);
}
