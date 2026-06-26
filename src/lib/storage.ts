const STORAGE_KEYS = {
  DISPLAY_PIN: 'sarda_display_pin',
  ADMIN_PIN: 'sarda_admin_pin',
  COMPANY_LOGO: 'sarda_company_logo',
  PIN_UNLOCKED: 'sarda_pin_unlocked',
  ADMIN_UNLOCKED: 'sarda_admin_unlocked',
} as const;

const DEFAULT_DISPLAY_PIN = '1234';
const DEFAULT_ADMIN_PIN = '4321';

const isClient = typeof window !== 'undefined';

function getLocalItem(key: string): string | null {
  if (!isClient) return null;
  return localStorage.getItem(key);
}

function setLocalItem(key: string, value: string): void {
  if (!isClient) return;
  localStorage.setItem(key, value);
}

function getSessionItem(key: string): string | null {
  if (!isClient) return null;
  return sessionStorage.getItem(key);
}

function setSessionItem(key: string, value: string): void {
  if (!isClient) return;
  sessionStorage.setItem(key, value);
}

function removeSessionItem(key: string): void {
  if (!isClient) return;
  sessionStorage.removeItem(key);
}

export function getDisplayPin(): string {
  return getLocalItem(STORAGE_KEYS.DISPLAY_PIN) || DEFAULT_DISPLAY_PIN;
}

export function setDisplayPin(pin: string): void {
  setLocalItem(STORAGE_KEYS.DISPLAY_PIN, pin);
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

export function lockAdmin(): void {
  removeSessionItem(STORAGE_KEYS.ADMIN_UNLOCKED);
}
