import { useEffect, useMemo } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Search, Lock, Settings, LogOut, Package, Droplets, Brush } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { ProductCard } from '@/components/ProductCard';
import { getCompanyLogo, isPinUnlocked, lockPin, isAdminUnlocked } from '@/lib/storage';
import { useIsClient } from '@/hooks/useIsClient';
import type { ProductCategory } from '@/types/product';

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
    refresh,
  } = useProducts();

  const companyLogo = getCompanyLogo();
  const adminMode = isAdminUnlocked();
  const unlocked = isPinUnlocked();
  const isClient = useIsClient();

  useEffect(() => {
    if (isClient && !unlocked) {
      navigate({ to: '/' });
    }
  }, [unlocked, navigate, isClient]);

  const handleLogout = () => {
    lockPin();
    navigate({ to: '/' });
  };

  const categories: { id: ProductCategory | 'all'; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'all', label: 'الكل', icon: <Package size={16} />, count: counts.all },
    { id: 'مواد التنظيف', label: 'مواد التنظيف', icon: <Droplets size={16} />, count: counts['مواد التنظيف'] },
    { id: 'أدوات التنظيف', label: 'أدوات التنظيف', icon: <Brush size={16} />, count: counts['أدوات التنظيف'] },
  ];

  if (!isClient || !unlocked) return null;

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
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
                    <rect x="8" y="8" width="32" height="32" rx="8" stroke="hsl(var(--primary))" strokeWidth="2" />
                    <path d="M16 24L22 30L34 18" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              <div>
                <h1 className="text-sm font-bold text-foreground leading-tight">شركة سردا</h1>
                <p className="text-[10px] text-muted-foreground">للتجارة والصناعة</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {adminMode && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                >
                  <Settings size={14} />
                  <span className="hidden sm:inline">لوحة التحكم</span>
                </Link>
              )}
              <Link
                to="/settings"
                aria-label="الإعدادات"
                className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                <Settings size={18} />
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}