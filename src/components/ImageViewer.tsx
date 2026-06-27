import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImageViewerProps {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
}

export function ImageViewer({ src, alt, open, onClose }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const lastTap = useRef(0);
  const initialDistance = useRef(0);
  const initialScale = useRef(1);

  const resetZoom = useCallback(() => setScale(1), []);

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
      initialDistance.current = getDistance(e.touches);
      initialScale.current = scale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = getDistance(e.touches);
      const newScale = Math.min(5, Math.max(0.5, initialScale.current * (dist / initialDistance.current)));
      setScale(newScale);
    }
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
            src={src}
            alt={alt}
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            animate={{ scale }}
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
