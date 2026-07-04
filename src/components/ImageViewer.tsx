import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface ImageViewerProps {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
  /**
   * Navigate to the adjacent product while the viewer stays open (the page
   * underneath swaps and `src`/`alt` update in place). 1 = next, -1 = previous.
   */
  onNavigate?: (direction: 1 | -1) => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

// Product navigation must be deliberate: a clear, fast, horizontal-dominant
// swipe — never a slow read-drag or the tail end of a pinch.
const SWIPE_MIN_DISTANCE = 70; // px
const SWIPE_MIN_VELOCITY = 0.35; // px/ms
const SWIPE_HORIZONTAL_DOMINANCE = 2; // |dx| must exceed |dy| * this

export function ImageViewer({ src, alt, open, onClose, onNavigate, hasNext, hasPrev }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  // Which way the last navigation went — drives the slide-in/out direction.
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef(0);
  const initialDistance = useRef(0);
  const initialScale = useRef(1);
  const swipeStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const pinchedDuringGesture = useRef(false);

  const resetZoom = useCallback(() => setScale(1), []);

  // Tab stays inside the viewer while it is open (close / nav / zoom buttons).
  useFocusTrap(containerRef, open);

  const navigate = useCallback(
    (direction: 1 | -1) => {
      if (!onNavigate) return;
      if (direction === 1 && !hasNext) return;
      if (direction === -1 && !hasPrev) return;
      setSlideDir(direction);
      setScale(1);
      onNavigate(direction);
    },
    [onNavigate, hasNext, hasPrev],
  );

  // Opening: start from a clean state (zoom persists across close otherwise,
  // because the component stays mounted) and lock the page scroll behind the overlay.
  useEffect(() => {
    if (!open) return;
    setScale(1);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Keyboard: Escape closes; arrows move between products (RTL: left = next).
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') navigate(1);
      else if (e.key === 'ArrowRight') navigate(-1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose, navigate]);

  // Double tap zoom
  const handleDoubleTap = () => {
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(2.5);
    }
  };

  // Touch handlers for pinch zoom
  const getDistance = (touches: React.TouchList | TouchList) => {
    const dx = (touches[0] as Touch).clientX - (touches[1] as Touch).clientX;
    const dy = (touches[0] as Touch).clientY - (touches[1] as Touch).clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch always wins — cancel any pending swipe and poison the gesture so
      // lifting one finger can't turn the remainder into a product switch.
      swipeStart.current = null;
      pinchedDuringGesture.current = true;
      initialDistance.current = getDistance(e.touches);
      initialScale.current = scale;
    } else if (e.touches.length === 1 && scale === 1) {
      // Only track swipes at rest zoom; when zoomed, one finger pans the image.
      pinchedDuringGesture.current = false;
      swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = getDistance(e.touches);
      const newScale = Math.min(5, Math.max(1, initialScale.current * (dist / initialDistance.current)));
      setScale(newScale);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || pinchedDuringGesture.current) return;
    if (scale !== 1 || e.touches.length > 0) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const elapsed = Math.max(1, performance.now() - start.t);
    // Deliberate swipe only: far enough, fast enough, clearly horizontal.
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return;
    if (Math.abs(dx) / elapsed < SWIPE_MIN_VELOCITY) return;
    if (Math.abs(dx) < Math.abs(dy) * SWIPE_HORIZONTAL_DOMINANCE) return;
    if (dx < 0) navigate(1); // swipe left → next
    else navigate(-1); // swipe right → previous
  };

  // Click handler for double tap detection
  const handleClick = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      handleDoubleTap();
    }
    lastTap.current = now;
  };

  const showNav = Boolean(onNavigate) && (hasNext || hasPrev);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          className="fixed inset-0 z-50 bg-foreground/95 flex items-center justify-center overflow-hidden"
          onClick={() => scale === 1 && onClose()}
        >
          {/* Close button */}
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="إغلاق"
            className="absolute top-4 left-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-background/10 text-background hover:bg-background/20 transition-colors"
          >
            <X size={22} />
          </button>

          {/* Product navigation — RTL: next is on the left, previous on the right */}
          {showNav && hasNext && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(1);
              }}
              aria-label="المنتج التالي"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 hidden lg:flex items-center justify-center rounded-full bg-background/10 text-background hover:bg-background/20 transition-colors"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          {showNav && hasPrev && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(-1);
              }}
              aria-label="المنتج السابق"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 hidden lg:flex items-center justify-center rounded-full bg-background/10 text-background hover:bg-background/20 transition-colors"
            >
              <ChevronRight size={22} />
            </button>
          )}

          {/* Zoom controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setScale((s) => Math.max(1, s - 0.5));
              }}
              disabled={scale <= 1}
              aria-label="تصغير"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-background/10 text-background hover:bg-background/20 transition-colors disabled:opacity-30"
            >
              <ZoomOut size={18} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resetZoom();
              }}
              aria-label="إعادة الضبط"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-background/10 text-background hover:bg-background/20 transition-colors"
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setScale((s) => Math.min(5, s + 0.5));
              }}
              disabled={scale >= 5}
              aria-label="تكبير"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-background/10 text-background hover:bg-background/20 transition-colors disabled:opacity-30"
            >
              <ZoomIn size={18} />
            </button>
          </div>

          {/* The image slides out/in when the product changes underneath the viewer */}
          <AnimatePresence mode="popLayout" initial={false} custom={slideDir}>
            <motion.img
              key={src}
              src={src}
              alt={alt}
              custom={slideDir}
              variants={{
                enter: (dir: 1 | -1) => ({ x: dir * 120, opacity: 0, scale: 1 }),
                center: { x: 0, opacity: 1 },
                exit: (dir: 1 | -1) => ({ x: dir * -120, opacity: 0 }),
              }}
              initial="enter"
              exit="exit"
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              drag={scale > 1}
              dragConstraints={containerRef}
              dragElastic={0.2}
              dragMomentum={false}
              animate={{ opacity: 1, scale, ...(scale === 1 ? { x: 0, y: 0 } : {}) }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="max-w-[95vw] max-h-[90vh] object-contain cursor-pointer"
              style={{ touchAction: 'none' }}
              draggable={false}
            />
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
