import { useState } from 'react';
import { createFileRoute, useParams, useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { ArrowRight, Package, Box } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { blink } from '@/blink/client';
import { ImageViewer } from '@/components/ImageViewer';
import type { Product } from '@/types/product';

async function fetchProduct(id: string): Promise<Product | null> {
  try {
    const result = await blink.db.table<Product>('products').get(id);
    return result || null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute('/product/$id')({
  head: ({ params }) => ({
    meta: [{ title: `تفاصيل المنتج — سردا` }],
  }),
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { id } = useParams({ from: '/product/$id' });
  const navigate = useNavigate();
  const [viewerOpen, setViewerOpen] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background gap-4" dir="rtl">
        <Package size={48} className="text-muted-foreground/40" strokeWidth={1} />
        <p className="text-muted-foreground">المنتج غير موجود</p>
        <button
          type="button"
          onClick={() => navigate({ to: '/catalog' })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
        >
          <ArrowRight size={16} />
          العودة للكتالوج
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background" dir="rtl">
      {/* Back button */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <button
            type="button"
            onClick={() => navigate({ to: '/catalog' })}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowRight size={18} />
            العودة
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Product image */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div
            className="relative aspect-[4/3] rounded-2xl bg-muted overflow-hidden cursor-pointer shadow-md"
            onClick={() => product.imageUrl && setViewerOpen(true)}
          >
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                <Package size={64} strokeWidth={1} />
              </div>
            )}
            {product.imageUrl && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-foreground/10">
                <span className="px-4 py-2 rounded-xl bg-background/90 text-sm font-medium shadow-sm backdrop-blur-sm">
                  اضغط للتكبير
                </span>
              </div>
            )}
            <span className="absolute top-2 right-2 px-3 py-1 rounded-full text-xs font-medium bg-background/90 text-foreground shadow-sm">
              {product.category}
            </span>
          </div>
        </motion.div>

        {/* Product info */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-6 space-y-4"
        >
          <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>

          {product.description && (
            <p className="text-base text-muted-foreground leading-relaxed">
              {product.description}
            </p>
          )}

          {/* Specs cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
            {product.size && (
              <div className="p-4 rounded-xl bg-card border border-border text-center">
                <p className="text-xs text-muted-foreground mb-1">الحجم</p>
                <p className="text-base font-bold text-foreground">{product.size}</p>
              </div>
            )}
            <div className="p-4 rounded-xl bg-card border border-border text-center">
              <Box size={16} className="mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground mb-1">الكمية في الكرتون</p>
              <p className="text-base font-bold text-foreground">
                {Number(product.cartonQuantity).toLocaleString('ar-SA')}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 text-center col-span-2 sm:col-span-1">
              <p className="text-xs text-muted-foreground mb-1">سعر الكرتون</p>
              <p className="text-xl font-extrabold text-accent">
                ₪{Number(product.cartonPrice).toLocaleString('ar-SA')}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Image viewer */}
      {product.imageUrl && (
        <ImageViewer
          src={product.imageUrl}
          alt={product.name}
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}
