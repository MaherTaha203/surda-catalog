import { useState, useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { PinPad } from '@/components/PinPad';
import { getAdminPin, unlockPin, unlockAdmin, isPinUnlocked } from '@/lib/storage';
import { useIsClient } from '@/hooks/useIsClient';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [{ title: 'سردا — كتالوج المنتجات' }],
  }),
  component: PinGate,
});

function PinGate() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'idle' | 'admin'>('idle');
  const [checked, setChecked] = useState(false);
  const isClient = useIsClient();

  useEffect(() => {
    // Already unlocked? Go straight to catalog
    if (isClient && isPinUnlocked()) {
      navigate({ to: '/catalog' });
      return;
    }
    setChecked(true);
  }, [navigate, isClient]);

  if (!checked) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (mode === 'idle') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-4 bg-background" dir="rtl">
        <motion.div
          className="w-full max-w-sm text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Logo placeholder */}
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="8" y="8" width="32" height="32" rx="8" stroke="hsl(var(--primary))" strokeWidth="2" />
              <path d="M16 24L22 30L34 18" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-2">شركة سردا</h1>
          <p className="text-sm text-muted-foreground mb-2">للتجارة والصناعة</p>
          <p className="text-xs text-muted-foreground/70 mb-8">كتالوج المنتجات</p>

          <div className="flex flex-col gap-3 max-w-[240px] mx-auto">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate({ to: '/catalog' })}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-sm hover:opacity-90 transition-opacity"
            >
              فتح الكتالوج
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => setMode('admin')}
              className="hidden lg:block w-full py-3 rounded-xl border-2 border-border text-muted-foreground font-medium text-sm hover:bg-muted/50 transition-colors"
            >
              لوحة المدير
            </motion.button>
          </div>

          {/* Version */}
          <p className="mt-12 text-[11px] text-muted-foreground/50">الإصدار 1.0</p>
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        key="admin-pin"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <PinPad
          title="رمز المدير"
          subtitle="أدخل رمز المدير للوصول إلى لوحة التحكم"
          correctPin={getAdminPin()}
          onSuccess={() => {
            unlockPin();
            unlockAdmin();
            navigate({ to: '/admin' });
          }}
          onBack={() => setMode('idle')}
        />
      </motion.div>
    </AnimatePresence>
  );
}