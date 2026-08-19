const STORAGE_KEYS = {
  ADMIN_PIN: 'sarda_admin_pin',
  COMPANY_LOGO: 'sarda_company_logo',
  PIN_UNLOCKED: 'sarda_pin_unlocked',
  ADMIN_UNLOCKED: 'sarda_admin_unlocked',
} as const;

const DEFAULT_ADMIN_PIN = '4321';

const isClient = typeof window !== 'undefined';

// Web Storage can THROW on access — not just on write (quota) but on read too
// when the browser blocks storage entirely (privacy settings, sandboxed frame,
// "block third-party cookies/data"). These accessors must never let a Storage
// error crash the app: a failed READ returns null (so the admin gate reads as
// LOCKED — fail closed, never granting access because storage is unavailable),
// and a failed WRITE is a silent no-op. Normal behaviour is unchanged whenever
// storage works.
function getLocalItem(key: string): string | null {
  if (!isClient) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setLocalItem(key: string, value: string): void {
  if (!isClient) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable/full — cannot persist; ignore */
  }
}

function getSessionItem(key: string): string | null {
  if (!isClient) return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSessionItem(key: string, value: string): void {
  if (!isClient) return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable/full — cannot persist; ignore */
  }
}

function removeSessionItem(key: string): void {
  if (!isClient) return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function getAdminPin(): string {
  return getLocalItem(STORAGE_KEYS.ADMIN_PIN) || DEFAULT_ADMIN_PIN;
}

export function setAdminPin(pin: string): void {
  setLocalItem(STORAGE_KEYS.ADMIN_PIN, pin);
}

export function getCompanyLogo(): string {
  return getLocalItem(STORAGE_KEYS.COMPANY_LOGO) || '';
}

export function setCompanyLogo(url: string): void {
  setLocalItem(STORAGE_KEYS.COMPANY_LOGO, url);
}

export function isPinUnlocked(): boolean {
  return getSessionItem(STORAGE_KEYS.PIN_UNLOCKED) === 'true';
}

export function unlockPin(): void {
  setSessionItem(STORAGE_KEYS.PIN_UNLOCKED, 'true');
}

export function lockPin(): void {
  removeSessionItem(STORAGE_KEYS.PIN_UNLOCKED);
  removeSessionItem(STORAGE_KEYS.ADMIN_UNLOCKED);
}

export function isAdminUnlocked(): boolean {
  return getSessionItem(STORAGE_KEYS.ADMIN_UNLOCKED) === 'true';
}

export function unlockAdmin(): void {
  setSessionItem(STORAGE_KEYS.ADMIN_UNLOCKED, 'true');
}
