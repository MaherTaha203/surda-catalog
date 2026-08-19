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

const ALL_DEVICE_FALLBACK = 'all';

// When Web Storage is blocked entirely, keep one ephemeral id for the session so
// the app never crashes reading it (the device just won't be remembered across
// reloads). Storage errors must degrade, never throw.
let memoryDeviceId: string | null = null;

/** Get (creating + persisting on first call) this browser's device_id. */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return ALL_DEVICE_FALLBACK;
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = makeDeviceId();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    if (!memoryDeviceId) memoryDeviceId = makeDeviceId();
    return memoryDeviceId;
  }
}

/** The rep's chosen device name, or '' if not set yet. */
export function getDeviceName(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(DEVICE_NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function setDeviceNameLocal(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEVICE_NAME_KEY, name);
  } catch {
    /* storage unavailable — name not persisted */
  }
}
