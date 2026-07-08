/**
 * Presentation Builder — add products from the REAL catalog (brief §1).
 *
 * Full-screen add-mode that reuses the exact catalog data (useProducts), search,
 * category chips, grid and ProductCard the rep uses every day — the only change
 * is a +/✓ affordance per card and a sticky "n added · done" bar. Not a picker
 * dialog, not a fork: the rep never feels they left the catalog.
 */
import { useMemo } from 'react';
import { ArrowRight, Search, Check } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useCatalogSettings } from '@/hooks/useCatalogSettings';
import { useDisplayPrefs, DENSITY_GRID, effectiveShowPrices } from '@/lib/display-prefs';
import { ProductCard } from '@/components/ProductCard';

interface Props {
  presentationName: string;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}

export function CatalogPicker({ presentationName, selectedIds, onToggle, onClose }: Props) {
  const { products, isLoading, searchQuery, setSearchQuery, selectedCategory, setSelectedCategory, counts } = useProducts();
  const settings = useCatalogSettings();
  const { prefs } = useDisplayPrefs();
  const showPrice = effectiveShowPrices(settings, prefs);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const categories: { id: 'all' | 'مواد التنظيف' | 'أدوات التنظيف'; label: string; count: number }[] = [
    { id: 'all', label: 'الكل', count: counts.all },
    { id: 'مواد التنظيف', label: 'مواد التنظيف', count: counts['مواد التنظيف'] },
    { id: 'أدوات التنظيف', label: 'أدوات التنظيف', count: counts['أدوات التنظيف'] },
  ];
  const catalogIds = products.map((p) => p.id);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" dir="rtl">
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowRight size={18} aria-hidden />
            <span className="hidden sm:inline">رجوع</span>
          </button>
          <h1 className="text-sm sm:text-base font-bold text-foreground truncate">
            تضيف إلى: <span className="text-primary">{presentationName}</span>
          </h1>
        </div>
        <div className="max-w-5xl mx-auto px-3 sm:px-4 pb-3 space-y-2">
          <div className="relative">
            <Search size={18} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" aria-hidden />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن منتج..."
              className="w-full h-11 pr-10 pl-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === c.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/70'
                }`}
              >
                {c.label}
                <span className={`px-1.5 rounded-full ${selectedCategory === c.id ? 'bg-primary-foreground/20' : 'bg-background'}`}>{c.count}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-24">
          {isLoading ? (
            <div className={DENSITY_GRID[prefs.density]}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="aspect-[4/5] rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-16">لا توجد منتجات مطابقة</p>
          ) : (
            <div className={DENSITY_GRID[prefs.density]}>
              {products.map((p, i) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  index={i}
                  showPrice={showPrice}
                  defaultImageUrl={settings.defaultProductImageUrl}
                  catalogIds={catalogIds}
                  onAdd={() => onToggle(p.id)}
                  added={selected.has(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <div className="sticky bottom-0 z-10 bg-background/90 backdrop-blur-md border-t border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{selectedIds.length} منتجات مضافة</span>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            <Check size={16} aria-hidden /> تم
          </button>
        </div>
      </div>
    </div>
  );
}
