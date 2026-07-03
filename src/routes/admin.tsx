import { useMemo, useState, useEffect } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { AnimatePresence } from 'framer-motion';
import { ArrowRight, Plus, Package, Search, X } from 'lucide-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from '@blinkdotnew/ui';
import {
  listProducts,
  deleteProduct,
  setProductVisibility,
  reorderProducts,
} from '@/api/products';
import { isAdminUnlocked, isPinUnlocked } from '@/lib/storage';
import { useIsClient } from '@/hooks/useIsClient';
import type { Product } from '@/types/product';
import { PRODUCTS_KEY } from '@/hooks/useProducts';
import { AdminProductForm } from '@/components/AdminProductForm';
import { AdminProductRow } from '@/components/AdminProductRow';

async function fetchAllProducts(): Promise<Product[]> {
  return listProducts();
}

export const Route = createFileRoute('/admin')({
  head: () => ({ meta: [{ title: 'لوحة التحكم — سردا' }] }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isClient = useIsClient();
  // Gate on isClient so SSR and the client's first render both produce the same
  // output (null) before mount — avoids a hydration mismatch from reading
  // sessionStorage (unavailable on the server).
  const unlocked = isClient && isPinUnlocked() && isAdminUnlocked();

  useEffect(() => { if (isClient && !unlocked) navigate({ to: '/' }); }, [unlocked, navigate, isClient]);

  const { data: products = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-products'],
    queryFn: fetchAllProducts,
    enabled: unlocked && isClient,
  });

  // Invalidate the public catalog's query so visitors see admin changes.
  const refreshCatalog = () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await deleteProduct(id); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      refreshCatalog();
      toast.success('تم حذف المنتج');
    },
    onError: (e: Error) => toast.error(e.message || 'فشل الحذف'),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isHidden }: { id: string; isHidden: number }) => {
      await setProductVisibility(id, isHidden);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      refreshCatalog();
    },
    onError: (e: Error) => toast.error(e.message || 'فشل تغيير حالة الإظهار'),
  });

  const reorderMutation = useMutation({
    mutationFn: async (items: { id: string; sortOrder: number }[]) => {
      await reorderProducts(items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      refreshCatalog();
    },
    onError: (e: Error) => toast.error(e.message || 'فشل تغيير الترتيب'),
  });

  const handleSaved = () => {
    setShowForm(false);
    setEditingProduct(null);
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    refreshCatalog();
  };

  const startAdd = () => { setEditingProduct(null); setShowForm(true); };
  const startEdit = (p: Product) => { setEditingProduct(p); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingProduct(null); };

  // Client-side filter — admins locate a product by name, description, or size.
  // Reordering works on the full, unfiltered list only (indices must match).
  const query = searchQuery.trim().toLowerCase();
  const filteredProducts = useMemo(() => {
    if (!query) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.size.toLowerCase().includes(query),
    );
  }, [products, query]);
  const isFiltering = query.length > 0;

  if (!unlocked) return null;

  const header = (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/catalog" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ArrowRight size={18} aria-hidden /> الكتالوج
          </Link>
          <h1 className="text-lg font-bold text-foreground">لوحة التحكم</h1>
        </div>
        <button type="button" onClick={startAdd} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus size={16} aria-hidden /> إضافة منتج
        </button>
      </div>
    </header>
  );

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background" dir="rtl">
        {header}
        <main className="max-w-4xl mx-auto px-4 py-4 animate-pulse space-y-2" aria-label="جارٍ التحميل" role="status">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted" />
          ))}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background" dir="rtl">
      {header}

      <main className="max-w-4xl mx-auto px-4 py-4">
        {isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package size={48} className="text-destructive/40 mb-4" strokeWidth={1} aria-hidden />
            <h3 className="text-lg font-bold text-foreground mb-2">تعذّر تحميل المنتجات</h3>
            <p className="text-sm text-muted-foreground mb-4">تحقّق من اتصال الخادم وحاول مرة أخرى.</p>
            <button type="button" onClick={() => refetch()} className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              إعادة المحاولة
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package size={48} className="text-muted-foreground/40 mb-4" strokeWidth={1} aria-hidden />
            <h3 className="text-lg font-bold text-foreground mb-2">لا توجد منتجات</h3>
            <p className="text-sm text-muted-foreground mb-4">ابدأ بإضافة أول منتج في الكتالوج</p>
            <button type="button" onClick={startAdd} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              <Plus size={16} aria-hidden /> إضافة منتج
            </button>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="relative mb-3">
              <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في المنتجات..."
                aria-label="بحث في المنتجات"
                className="w-full h-10 pr-10 pl-9 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring"
              />
              {isFiltering && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="مسح البحث"
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search size={40} className="text-muted-foreground/40 mb-3" strokeWidth={1} aria-hidden />
                <p className="text-sm text-muted-foreground">لا توجد نتائج مطابقة لبحثك</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProducts.map((product) => {
                  const i = products.indexOf(product);
                  return (
                    <AdminProductRow
                      key={product.id}
                      product={product}
                      index={filteredProducts.indexOf(product)}
                      isFirst={i === 0}
                      isLast={i === products.length - 1}
                      reorderDisabled={isFiltering || reorderMutation.isPending}
                      deleteDisabled={deleteMutation.isPending}
                      onEdit={startEdit}
                      onDelete={(id) => deleteMutation.mutate(id)}
                      onToggleHide={(id, cur) => toggleMutation.mutate({ id, isHidden: cur ? 0 : 1 })}
                      onMoveUp={() => {
                        if (i > 0) {
                          reorderMutation.mutate([
                            { id: product.id, sortOrder: i - 1 },
                            { id: products[i - 1].id, sortOrder: i },
                          ]);
                        }
                      }}
                      onMoveDown={() => {
                        if (i < products.length - 1) {
                          reorderMutation.mutate([
                            { id: product.id, sortOrder: i + 1 },
                            { id: products[i + 1].id, sortOrder: i },
                          ]);
                        }
                      }}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
        {!isError && (
          <p className="text-xs text-muted-foreground text-center mt-6">
            {isFiltering
              ? `${filteredProducts.length} من ${products.length} منتج`
              : `${products.length} منتج في الكتالوج`}
          </p>
        )}
      </main>

      <AnimatePresence>
        {showForm && (
          <AdminProductForm
            open={showForm}
            editingProduct={editingProduct}
            productCount={products.length}
            onClose={closeForm}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
