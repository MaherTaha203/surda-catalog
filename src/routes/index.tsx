import { useState, useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { isPinUnlocked } from '@/lib/storage';
import { useIsClient } from '@/hooks/useIsClient';
import { BrandMark, BrandWordmark } from '@/components/BrandMark';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [{ title: 'سردا — كتالوج المنتجات' }],
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const isClient = useIsClient();

  useEffect(() => {
    // Already unlocked? Go straight to catalog. `replace` keeps this redirect
    // out of history — otherwise Back from the catalog lands here and gets
    // bounced forward again forever.
    if (isClient && isPinUnlocked()) {
      navigate({ to: '/catalog', replace: true });
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

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 bg-background" dir="rtl">
      <motion.div
        className="w-full max-w-sm text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* SurdaCatalog placeholder branding (final artwork comes later) */}
        <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center">
          <BrandMark size={88} />
        </div>
        <BrandWordmark className="block text-lg mb-4" />

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
          {/* Admin access moved to the discreet lock icon in the catalog header. */}
        </div>

        {/* Version */}
        <p className="mt-12 text-[11px] text-muted-foreground/50">الإصدار 1.0</p>
      </motion.div>
    </div>
  );
}
