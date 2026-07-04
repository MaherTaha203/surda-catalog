/**
 * Brute-force throttling for PIN entry.
 *
 * The admin PIN is a device-level gate (checked in the browser), so the
 * throttle is client-side too — but it is PERSISTED to localStorage, keyed per
 * use, so a page reload can't reset the counter and walk past it. After a few
 * wrong attempts the pad locks for a growing cooldown; a correct PIN clears it.
 *
 * Schedule: the first LOCK_THRESHOLD attempts are free. From the Nth wrong
 * attempt onward the pad locks for BASE_MS, doubling on each further failure up
 * to MAX_MS (so repeated guessing gets exponentially slower without ever
 * permanently locking the real admin out).
 */
const LOCK_THRESHOLD = 5; // wrong attempts allowed before the first lock
const BASE_MS = 60_000; // first lock: 60s
const MAX_MS = 15 * 60_000; // cooldown cap: 15 min

export interface LockoutState {
  /** Total consecutive wrong attempts. */
  fails: number;
  /** Epoch ms until which entry is blocked (0 = not locked). */
  lockUntil: number;
}

const EMPTY: LockoutState = { fails: 0, lockUntil: 0 };
const storageKey = (key: string) => `sarda_pin_lockout_${key}`;

export function readLockout(key: string): LockoutState {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<LockoutState>;
    return {
      fails: Number(parsed.fails) || 0,
      lockUntil: Number(parsed.lockUntil) || 0,
    };
  } catch {
    return EMPTY;
  }
}

function write(key: string, state: LockoutState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode) — throttle degrades to in-memory */
  }
}

/**
 * Record one wrong attempt and return the new state. Once the threshold is
 * reached, `lockUntil` is set to a cooldown that grows exponentially with each
 * additional failure (capped at MAX_MS).
 */
export function registerFailure(key: string, now: number): LockoutState {
  const prev = readLockout(key);
  const fails = prev.fails + 1;
  let lockUntil = 0;
  if (fails >= LOCK_THRESHOLD) {
    const over = fails - LOCK_THRESHOLD; // 0 on the first lock
    const duration = Math.min(MAX_MS, BASE_MS * 2 ** over);
    lockUntil = now + duration;
  }
  const next = { fails, lockUntil };
  write(key, next);
  return next;
}

/** Clear the throttle (call on a correct PIN). */
export function clearLockout(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(key));
  } catch {
    /* ignore */
  }
}

/** Milliseconds of cooldown remaining, or 0 if not currently locked. */
export function remainingMs(state: LockoutState, now: number): number {
  return Math.max(0, state.lockUntil - now);
}
