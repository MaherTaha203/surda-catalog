import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImageViewerProps {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
  /** Optional gallery — swipe horizontally to navigate. Defaults to the single `src`. */
  images?: string[];
  initialIndex?: number;
}

export function ImageViewer({ src, alt, open, onClose, images, initialIndex = 0 }: ImageViewerProps) {
  const gallery = images && images.length > 0 ? images : [src];
  const [index, setIndex] = useState(Math.min(initialIndex, gallery.length - 1));
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const lastTap = useRef(0);
  const initialDistance = useRef(0);
  const initialScale = useRef(1);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const resetZoom = useCallback(() => setScale(1), []);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= gallery.length) return;
      setIndex(next);
      setScale(1);
    },
    [gallery.length],
  );

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

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
      // Pinch takes over — cancel any pending swipe.
      swipeStart.current = null;
      initialDistance.current = getDistance(e.touches);
      initialScale.current = scale;
    } else if (e.touches.length === 1 && scale === 1) {
      // Only track swipes at rest zoom; when zoomed, one finger pans the image.
      swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = getDistance(e.touches);
      const newScale = Math.min(5, Math.max(0.5, initialScale.current * (dist / initialDistance.current)));
      setScale(newScale);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || scale !== 1 || gallery.length < 2 || e.touches.length > 0) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // Horizontal-dominant swipe past the threshold navigates the gallery.
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) goTo(index + 1); // swipe left → next
    else goTo(index - 1); // swipe right → previous
  };

  // Click handler for double tap detection
  const handleClick = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      handleDoubleTap();
    }
    lastTap.current = now;
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-foreground/95 flex items-center justify-center"
          onClick={() => scale === 1 && onClose()}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="absolute top-4 left-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-background/10 text-background hover:bg-background/20 transition-colors"
          >
            <X size={22} />
          </button>

          {/* Zoom controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setScale((s) => Math.max(0.5, s - 0.5));
              }}
              disabled={scale <= 0.5}
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

          <motion.img
            ref={imageRef}
            src={gallery[index]}
            alt={alt}
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
            animate={{ scale, ...(scale === 1 ? { x: 0, y: 0 } : {}) }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="max-w-[95vw] max-h-[90vh] object-contain cursor-pointer"
            style={{ touchAction: 'none' }}
            draggable={false}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
