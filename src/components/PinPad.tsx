import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PinPadProps {
  title: string;
  subtitle: string;
  correctPin: string;
  onSuccess: () => void;
  onBack?: () => void;
  /** Hosts with their own close affordance (the dialog's ×) hide the text button. */
  hideBackButton?: boolean;
}

/**
 * PIN entry core — dots, numeric pad, physical keyboard support (digits,
 * Backspace, Escape→onBack). Embedded by the admin PIN dialog; wrap it
 * yourself for a full-page layout.
 */
export function PinPad({ title, subtitle, correctPin, onSuccess, onBack, hideBackButton }: PinPadProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length >= 4) return;
      setError(false);
      const next = pin + digit;
      setPin(next);
      if (next.length === 4) {
        if (next === correctPin) {
          setTimeout(onSuccess, 150);
        } else {
          setError(true);
          setShakeKey((k) => k + 1);
          setTimeout(() => {
            setPin('');
            setError(false);
          }, 600);
        }
      }
    },
    [pin, correctPin, onSuccess]
  );

  // Backspace icon = remove the last digit (its previous clear-all behavior
  // contradicted the icon and standard PIN-pad expectations).
  const handleBackspace = useCallback(() => {
    setPin((p) => p.slice(0, -1));
    setError(false);
  }, []);

  // Physical keyboard support — the admin entry is desktop-first, so digits,
  // Backspace, and Escape must work without the mouse.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) handleDigit(e.key);
      else if (e.key === 'Backspace') handleBackspace();
      else if (e.key === 'Escape' && onBack) onBack();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleDigit, handleBackspace, onBack]);

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'];

  return (
    <div className="w-full" dir="rtl">
      {/* Heading */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Pin dots */}
      <motion.div
        className="flex items-center justify-center gap-3 mb-8"
        key={shakeKey}
        animate={error ? { x: [0, -10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              'w-5 h-5 rounded-full border-2 transition-all duration-200',
              i < pin.length
                ? error
                  ? 'border-destructive bg-destructive'
                  : 'border-primary bg-primary'
                : 'border-border bg-transparent'
            )}
          />
        ))}
      </motion.div>

      {error && (
        <p className="text-center text-sm text-destructive mb-4 animate-fade-in">
          رمز الدخول غير صحيح
        </p>
      )}

      {/* Number pad */}
      <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
        {digits.map((d) => {
          if (d === '') {
            return <div key="empty" />;
          }
          if (d === 'delete') {
            return (
              <button
                key="delete"
                type="button"
                onClick={handleBackspace}
                disabled={pin.length === 0}
                aria-label="حذف آخر رقم"
                className="flex items-center justify-center h-14 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                  <line x1="18" y1="9" x2="12" y2="15" />
                  <line x1="12" y1="9" x2="18" y2="15" />
                </svg>
              </button>
            );
          }
          return (
            <motion.button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              whileTap={{ scale: 0.92 }}
              className="flex items-center justify-center h-14 rounded-2xl bg-card border border-border text-xl font-bold text-foreground shadow-sm hover:bg-muted/50 transition-colors active:bg-muted"
            >
              {d}
            </motion.button>
          );
        })}
      </div>

      {onBack && !hideBackButton && (
        <button
          type="button"
          onClick={onBack}
          className="mt-8 mx-auto block text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          رجوع
        </button>
      )}
    </div>
  );
}
