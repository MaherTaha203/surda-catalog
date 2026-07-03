/**
 * Native drag & drop list reordering, replacing the old up/down buttons.
 *
 * - Desktop: press and drag with the mouse (a real click without movement
 *   still clicks — the drag engages only after ~6px of travel).
 * - Touch: long-press (≈350ms without moving) lifts the row, then dragging
 *   reorders; a normal swipe scrolls the list as usual. While a drag is
 *   active, page scrolling is suppressed with a non-passive touchmove.
 * - The window auto-scrolls when dragging near the viewport edges.
 * - Rows are assumed uniform height (they are); siblings animate via the
 *   caller's framer `layout` wrappers, the lifted row follows the pointer.
 *
 * The hook only manages the gesture + a local order; the caller persists on
 * commit (called once, on drop, only if the order actually changed).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface DragSession<T> {
  id: string;
  order: T[];
  /** Pointer offset of the lifted row relative to its CURRENT slot. */
  dy: number;
}

interface Options<T> {
  items: T[];
  disabled: boolean;
  onCommit: (order: T[]) => void;
}

const LONG_PRESS_MS = 350;
const TOUCH_CANCEL_DISTANCE = 10; // px of pre-lift movement that means "scrolling"
const MOUSE_ENGAGE_DISTANCE = 6;
const EDGE_ZONE = 110; // px from viewport edge that triggers auto-scroll
const ROW_GAP = 8; // space-y-2

const isInteractive = (target: EventTarget | null): boolean =>
  target instanceof Element && Boolean(target.closest('button, a, input, textarea, [role="dialog"]'));

export function useDragReorder<T extends { id: string }>({ items, disabled, onCommit }: Options<T>) {
  const [session, setSession] = useState<DragSession<T> | null>(null);

  const state = useRef<{
    engaged: boolean;
    id: string;
    startIndex: number;
    curIndex: number;
    order: T[];
    startPageY: number;
    lastClientY: number;
    rowHeight: number;
    startClientX: number;
    startClientY: number;
    longPressTimer: ReturnType<typeof setTimeout> | null;
    raf: number | null;
    cleanupFns: (() => void)[];
  } | null>(null);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const teardown = useCallback(() => {
    const s = state.current;
    if (!s) return;
    if (s.longPressTimer) clearTimeout(s.longPressTimer);
    if (s.raf !== null) cancelAnimationFrame(s.raf);
    s.cleanupFns.forEach((fn) => fn());
    state.current = null;
    setSession(null);
  }, []);

  useEffect(() => teardown, [teardown]);

  const applyPointer = useCallback((clientY: number) => {
    const s = state.current;
    if (!s?.engaged) return;
    s.lastClientY = clientY;
    const pageY = clientY + window.scrollY;
    const rawDy = pageY - s.startPageY;
    const slotShift = Math.round(rawDy / s.rowHeight);
    const targetIndex = Math.max(0, Math.min(s.order.length - 1, s.startIndex + slotShift));
    if (targetIndex !== s.curIndex) {
      const next = [...s.order];
      const [moved] = next.splice(s.curIndex, 1);
      next.splice(targetIndex, 0, moved);
      s.order = next;
      s.curIndex = targetIndex;
    }
    const dy = rawDy - (s.curIndex - s.startIndex) * s.rowHeight;
    setSession({ id: s.id, order: s.order, dy });
  }, []);

  const commit = useCallback(() => {
    const s = state.current;
    if (s?.engaged) {
      const changed = s.order.some((item, i) => item.id !== itemsRef.current[i]?.id);
      if (changed) onCommitRef.current(s.order);
      // Swallow the click that may follow a completed mouse drag so it can't
      // press whatever ends up under the pointer. The browser only fires that
      // click sometimes (same-target rule), so disarm shortly after either way.
      const swallow = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
      };
      window.addEventListener('click', swallow, { capture: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 80);
    }
    teardown();
  }, [teardown]);

  const engage = useCallback(
    (rowEl: HTMLElement) => {
      const s = state.current;
      if (!s || s.engaged) return;
      s.engaged = true;
      s.rowHeight = rowEl.getBoundingClientRect().height + ROW_GAP;
      s.startPageY = s.startClientY + window.scrollY;
      s.order = [...itemsRef.current];
      navigator.vibrate?.(10);
      setSession({ id: s.id, order: s.order, dy: 0 });

      // Auto-scroll near the viewport edges; scrolling changes pageY, so
      // re-apply the pointer position every frame while inside the zone.
      const tick = () => {
        const st = state.current;
        if (!st?.engaged) return;
        const y = st.lastClientY;
        let delta = 0;
        if (y < EDGE_ZONE) delta = -Math.ceil((EDGE_ZONE - y) / 8);
        else if (y > window.innerHeight - EDGE_ZONE) delta = Math.ceil((y - (window.innerHeight - EDGE_ZONE)) / 8);
        if (delta !== 0) {
          window.scrollBy(0, delta);
          applyPointer(y);
        }
        st.raf = requestAnimationFrame(tick);
      };
      s.raf = requestAnimationFrame(tick);
    },
    [applyPointer],
  );

  /** Mouse path: engage after a small movement so plain clicks stay clicks. */
  const onMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (disabled || e.button !== 0 || isInteractive(e.target) || state.current) return;
      const rowEl = e.currentTarget as HTMLElement;
      state.current = {
        engaged: false,
        id,
        startIndex: itemsRef.current.findIndex((it) => it.id === id),
        curIndex: itemsRef.current.findIndex((it) => it.id === id),
        order: itemsRef.current,
        startPageY: 0,
        lastClientY: e.clientY,
        rowHeight: 1,
        startClientX: e.clientX,
        startClientY: e.clientY,
        longPressTimer: null,
        raf: null,
        cleanupFns: [],
      };
      const onMove = (ev: MouseEvent) => {
        const s = state.current;
        if (!s) return;
        if (!s.engaged) {
          if (Math.hypot(ev.clientX - s.startClientX, ev.clientY - s.startClientY) < MOUSE_ENGAGE_DISTANCE) return;
          s.startClientY = ev.clientY;
          engage(rowEl);
        }
        ev.preventDefault(); // no text selection while dragging
        applyPointer(ev.clientY);
      };
      const onUp = () => commit();
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      state.current.cleanupFns.push(() => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      });
    },
    [disabled, engage, applyPointer, commit],
  );

  /** Touch path: long-press lifts the row; early movement means scrolling. */
  const onTouchStart = useCallback(
    (e: React.TouchEvent, id: string) => {
      if (disabled || e.touches.length !== 1 || isInteractive(e.target) || state.current) return;
      const rowEl = e.currentTarget as HTMLElement;
      const touch = e.touches[0];
      state.current = {
        engaged: false,
        id,
        startIndex: itemsRef.current.findIndex((it) => it.id === id),
        curIndex: itemsRef.current.findIndex((it) => it.id === id),
        order: itemsRef.current,
        startPageY: 0,
        lastClientY: touch.clientY,
        rowHeight: 1,
        startClientX: touch.clientX,
        startClientY: touch.clientY,
        longPressTimer: null,
        raf: null,
        cleanupFns: [],
      };
      const onMove = (ev: TouchEvent) => {
        const s = state.current;
        if (!s) return;
        const t = ev.touches[0];
        if (!t) return;
        if (!s.engaged) {
          // Finger travelled before the long press finished → it's a scroll.
          if (Math.hypot(t.clientX - s.startClientX, t.clientY - s.startClientY) > TOUCH_CANCEL_DISTANCE) {
            teardown();
          }
          return;
        }
        if (ev.cancelable) ev.preventDefault(); // suppress scrolling while lifted
        applyPointer(t.clientY);
      };
      const onEnd = () => (state.current?.engaged ? commit() : teardown());
      // Non-passive so preventDefault works once the drag is engaged.
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
      window.addEventListener('touchcancel', onEnd);
      state.current.cleanupFns.push(() => {
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
        window.removeEventListener('touchcancel', onEnd);
      });
      state.current.longPressTimer = setTimeout(() => {
        const s = state.current;
        if (s && !s.engaged) engage(rowEl);
      }, LONG_PRESS_MS);
    },
    [disabled, engage, applyPointer, commit, teardown],
  );

  return { session, onMouseDown, onTouchStart };
}
