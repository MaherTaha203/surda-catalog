import { useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Search, Lock, LogOut, Package, Droplets, Brush, SlidersHorizontal } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useCatalogSettings } from '@/hooks/useCatalogSettings';
import { ProductCard } from '@/components/ProductCard';
import { AdminPinDialog } from '@/components/AdminPinDialog';
import { BrandMark } from '@/components/BrandMark';
import { getCompanyLogo, lockPin, unlockPin, unlockAdmin, isAdminUnlocked } from '@/lib/storage';
import { useIsClient } from '@/hooks/useIsClient';
import { useDisplayPrefs, effectiveShowPrices, DENSITY_GRID, FONT_CLASSES } from '@/lib/display-prefs';
import type { ProductCategory } from '@/types/product';
// [notifications-feature] EXPERIMENTAL — remove this import + <NotificationBell/> to delete the feature.
import { NotificationBell } from '@/features/notifications';

export const Route = createFileRoute('/catalog')({
  head: () => ({
    meta: [{ title: 'الكتالوج — سردا' }],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const navigate = useNavigate();
  const {
    products,
    isLoading,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    counts,
  } = useProducts();

  const companyLogo = getCompanyLogo();
  const adminMode = isAdminUnlocked();
  const isClient = useIsClient();
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  const settings = useCatalogSettings();
  const { prefs } = useDisplayPrefs();
  const font = FONT_CLASSES[prefs.fontScale];
  const showPrices = effectiveShowPrices(settings, prefs);
  // One shared list per render — every card links with the same context.
  const catalogIds = useMemo(() => products.map((p) => p.id), [products]);

  const handleLogout = () => {
    lockPin();
    navigate({ to: '/' });
  };

  // Scroll restoration: the router restores before this client-gated page has
  // any height, so the position clamps to the top. Track the position per
  // history entry ourselves and re-apply it once the grid has rendered.
  const restoredScroll = useRef(false);
  useEffect(() => {
    const entryKey = () =>
      (window.history.state as { __TSR_key?: string } | null)?.__TSR_key ?? '';
    const onScroll = () => {
      const key = entryKey();
      if (key) sessionStorage.setItem(`sarda_catalog_scroll_${key}`, String(window.scrollY));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    // Wait for the grid to actually be in the DOM: isClient gates rendering,
    // so an earlier run would scroll an empty (zero-height) page.
    if (!isClient || restoredScroll.current || isLoading || products.length === 0) return;
    restoredScroll.current = true;
    const key = (window.history.state as { __TSR_key?: string } | null)?.__TSR_key;
    if (!key) return;
    const saved = Number(sessionStorage.getItem(`sarda_catalog_scroll_${key}`) || 0);
    if (saved > 0) window.scrollTo({ top: saved });
  }, [isClient, isLoading, products.length]);

  const categories: { id: ProductCategory | 'all'; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'all', label: 'الكل', icon: <Package size={16} />, count: counts.all },
    { id: 'مواد التنظيف', label: 'مواد التنظيف', icon: <Droplets size={16} />, count: counts['مواد التنظيف'] },
    { id: 'أدوات التنظيف', label: 'أدوات التنظيف', icon: <Brush size={16} />, count: counts['أدوات التنظيف'] },
  ];

  if (!isClient) return null;

  return (
    <div className="min-h-dvh bg-background" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo + title */}
            <div className="flex items-center gap-3">
              {companyLogo ? (
                <img src={companyLogo} alt="شعار سردا" className="h-10 w-10 rounded-xl object-cover" />
              ) : (
                <BrandMark size={40} />
              )}
              <div>
                <h1 className="text-sm font-bold text-foreground leading-tight">شركة سردا</h1>
                <p className="text-[10px] text-muted-foreground">للتجارة والصناعة</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {/* [notifications-feature] EXPERIMENTAL — tiny bell + unread badge. */}
              <NotificationBell />
              {/* Discreet admin entry — a plain system-looking lock icon.
                  Unlocked sessions go straight in; otherwise the PIN dialog opens. */}
              <button
                type="button"
                onClick={() => (adminMode ? navigate({ to: '/admin' }) : setPinDialogOpen(true))}
                aria-label="لوحة التحكم"
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Lock size={18} />
              </button>
              <Link
                to="/preferences"
                aria-label="خيارات العرض"
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <SlidersHorizontal size={18} />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="تسجيل الخروج"
                className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Search bar */}
      <div className="max-w-7xl mx-auto px-4 pt-4 pb-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن منتج..."
            aria-label="ابحث عن منتج"
            className="w-full h-12 pr-11 pl-4 rounded-xl bg-card border border-border text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all"
            dir="rtl"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="max-w-7xl mx-auto px-4 pb-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {categories.map((cat) => (
            <motion.button
              key={cat.id}
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all duration-200 ${font.categoryChip} ${
                selectedCategory === cat.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-card border border-border text-foreground hover:bg-muted/50'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                selectedCategory === cat.id ? 'bg-primary-foreground/20' : 'bg-muted'
              }`}>
                {cat.count}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      <main className="max-w-7xl mx-auto px-4 pb-8">
        {isLoading ? (
          <div className={DENSITY_GRID[prefs.density]}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-card border border-border overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-muted" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-5 bg-muted rounded w-1/4 mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <Package size={48} className="text-muted-foreground/40 mb-4" strokeWidth={1} />
            <h3 className="text-lg font-bold text-foreground mb-2">لا توجد منتجات</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {searchQuery
                ? 'لا توجد نتائج تطابق بحثك. جرب كلمات أخرى.'
                : 'لم تتم إضافة منتجات بعد. أضف منتجات من لوحة التحكم.'}
            </p>
            {adminMode && !searchQuery && (
              <Link
                to="/admin"
                className="mt-4 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                إضافة منتجات
              </Link>
            )}
          </motion.div>
        ) : (
          <div className={DENSITY_GRID[prefs.density]}>
            {products.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                index={i}
                showPrice={showPrices}
                defaultImageUrl={settings.defaultProductImageUrl}
                catalogIds={catalogIds}
              />
            ))}
          </div>
        )}
      </main>

      <AdminPinDialog
        open={pinDialogOpen}
        onClose={() => setPinDialogOpen(false)}
        onSuccess={() => {
          unlockPin();
          unlockAdmin();
          setPinDialogOpen(false);
          navigate({ to: '/admin' });
        }}
      />
    </div>
  );
}