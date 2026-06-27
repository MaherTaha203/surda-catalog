import { useState, useEffect } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { AnimatePresence } from 'framer-motion';
import { ArrowRight, Plus, Package } from 'lucide-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from '@blinkdotnew/ui';
import {
  listProducts,
  deleteProduct,
  setProductVisibility,
  setProductOrder,
} from '@/api/products';
import { isAdminUnlocked, isPinUnlocked } from '@/lib/storage';
import { useIsClient } from '@/hooks/useIsClient';
import type { Product } from '@/types/product';
import { useProducts } from '@/hooks/useProducts';
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
  const { refresh } = useProducts();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const unlocked = isPinUnlocked() && isAdminUnlocked();
  const isClient = useIsClient();

  useEffect(() => { if (isClient && !unlocked) navigate({ to: '/' }); }, [unlocked, navigate, isClient]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: fetchAllProducts,
    enabled: unlocked && isClient,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await deleteProduct(id); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      refresh();
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
      refresh();
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, sortOrder }: { id: string; sortOrder: number }) => {
      await setProductOrder(id, sortOrder);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      refresh();
    },
  });

  const handleSaved = () => {
    setShowForm(false);
    setEditingProduct(null);
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    refresh();
  };

  const startAdd = () => { setEditingProduct(null); setShowForm(true); };
  const startEdit = (p: Product) => { setEditingProduct(p); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingProduct(null); };

  if (!unlocked) return null;
  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background" dir="rtl">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/catalog" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <ArrowRight size={18} /> الكتالوج
            </Link>
            <h1 className="text-lg font-bold text-foreground">لوحة التحكم</h1>
          </div>
          <button type="button" onClick={startAdd} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={16} /> إضافة منتج
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package size={48} className="text-muted-foreground/40 mb-4" strokeWidth={1} />
            <h3 className="text-lg font-bold text-foreground mb-2">لا توجد منتجات</h3>
            <p className="text-sm text-muted-foreground mb-4">ابدأ بإضافة أول منتج في الكتالوج</p>
            <button type="button" onClick={startAdd} className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              <Plus size={16} className="inline mr-1" /> إضافة منتج
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((product, i) => (
              <AdminProductRow
                key={product.id}
                product={product}
                index={i}
                isFirst={i === 0}
                isLast={i === products.length - 1}
                onEdit={startEdit}
                onDelete={(id) => deleteMutation.mutate(id)}
                onToggleHide={(id, cur) => toggleMutation.mutate({ id, isHidden: cur ? 0 : 1 })}
                onMoveUp={() => {
                  if (i > 0) {
                    reorderMutation.mutate({ id: product.id, sortOrder: i - 1 });
                    reorderMutation.mutate({ id: products[i - 1].id, sortOrder: i });
                  }
                }}
                onMoveDown={() => {
                  if (i < products.length - 1) {
                    reorderMutation.mutate({ id: product.id, sortOrder: i + 1 });
                    reorderMutation.mutate({ id: products[i + 1].id, sortOrder: i });
                  }
                }}
              />
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground text-center mt-6">{products.length} منتج في الكتالوج</p>
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
