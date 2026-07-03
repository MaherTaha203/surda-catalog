import { useEffect, useState } from 'react';
import { createFileRoute, useParams, useNavigate, useRouter, useCanGoBack } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { ArrowRight, Package, PackageOpen, ZoomIn } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProduct } from '@/api/products';
import { getCachedProducts } from '@/lib/offline-db';
import { ImageViewer } from '@/components/ImageViewer';
import type { Product } from '@/types/product';

async function fetchProduct(id: string): Promise<Product | null> {
  try {
    // Loads from the Fastify API (getProduct returns null on a 404).
    return await getProduct(id);
  } catch {
    // API unavailable → fall back to the offline cache (populated by the
    // catalog). Cached products already carry display-ready image URLs.
    const cached = await getCachedProducts();
    return cached.find((p) => p.id === id) ?? null;
  }
}

export const Route = createFileRoute('/product/$id')({
  head: () => ({
    meta: [{ title: `تفاصيل المنتج — سردا` }],
  }),
  component: ProductDetailPage,
});

/** Sticky top bar with the back action — shared by the loaded and loading states. */
function PageHeader({ onBack }: { onBack: () => void }) {
  return (
    <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-3xl mx-auto px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowRight size={18} aria-hidden />
          العودة
        </button>
      </div>
    </div>
  );
}

function ProductDetailPage() {
  const { id } = useParams({ from: '/product/$id' });
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const queryClient = useQueryClient();
  const [viewerOpen, setViewerOpen] = useState(false);

  // Coming from the catalog, history back restores its scroll position and
  // filters; on a deep link (no in-app history) fall back to the catalog.
  const goBack = () => {
    if (canGoBack) router.history.back();
    else navigate({ to: '/catalog' });
  };

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
    // Paint instantly with the copy the catalog already fetched (same display
    // shape — absolute image URLs) while the fresh fetch runs in the background.
    placeholderData: () =>
      queryClient.getQueryData<Product[]>(['products'])?.find((p) => p.id === id),
  });

  // The route's head() runs before data exists; set the real title once loaded.
  useEffect(() => {
    if (product?.name) document.title = `${product.name} — سردا`;
  }, [product?.name]);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background" dir="rtl">
        <PageHeader onBack={goBack} />
        <div className="max-w-3xl mx-auto px-4 py-4 animate-pulse" aria-label="جارٍ التحميل" role="status">
          <div className="aspect-[4/3] rounded-2xl bg-muted" />
          <div className="mt-6 space-y-4">
            <div className="h-7 w-2/3 rounded-lg bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-4/5 rounded bg-muted" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="h-[5.25rem] rounded-xl bg-muted" />
              <div className="h-[5.25rem] rounded-xl bg-muted" />
              <div className="h-[5.25rem] rounded-xl bg-muted col-span-2 sm:col-span-1" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background gap-4" dir="rtl">
        <Package size={48} className="text-muted-foreground/40" strokeWidth={1} aria-hidden />
        <p className="text-muted-foreground">المنتج غير موجود</p>
        <button
          type="button"
          onClick={() => navigate({ to: '/catalog' })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
        >
          <ArrowRight size={16} aria-hidden />
          العودة للكتالوج
        </button>
      </div>
    );
  }

  const hasOffer = Number(product.offerPrice) > 0;

  return (
    <div className="min-h-dvh bg-background" dir="rtl">
      <PageHeader onBack={goBack} />

      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Product image */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <button
            type="button"
            disabled={!product.imageUrl}
            onClick={() => setViewerOpen(true)}
            aria-label="عرض الصورة بالحجم الكامل"
            className="group relative block w-full aspect-[4/3] rounded-2xl bg-muted overflow-hidden shadow-md disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                decoding="async"
                fetchPriority="high"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                <Package size={64} strokeWidth={1} aria-hidden />
              </div>
            )}
            {product.imageUrl && (
              <>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity bg-foreground/10">
                  <span className="px-4 py-2 rounded-xl bg-background/90 text-sm font-medium shadow-sm backdrop-blur-sm">
                    اضغط للتكبير
                  </span>
                </div>
                {/* Always-visible affordance — the hover hint never shows on touch screens */}
                <span className="absolute bottom-2 left-2 w-8 h-8 flex items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur-sm">
                  <ZoomIn size={15} aria-hidden />
                </span>
              </>
            )}
            <span className="absolute top-2 right-2 px-3 py-1 rounded-full text-xs font-medium bg-background/90 text-foreground shadow-sm">
              {product.category}
            </span>
          </button>
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
            <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          )}

          {/* Specs cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {product.size && (
              <div className="p-4 rounded-xl bg-card border border-border text-center">
                <p className="text-xs text-muted-foreground mb-1">الحجم</p>
                <p className="text-base font-bold text-foreground">{product.size}</p>
              </div>
            )}
            <div className="p-4 rounded-xl bg-card border border-border text-center">
              <p className="text-xs text-muted-foreground mb-1">الكمية في الكرتون</p>
              <p className="text-base font-bold text-foreground flex items-center justify-center gap-1.5">
                <span>{Number(product.cartonQuantity).toLocaleString('en-US')}</span>
                <span className="text-muted-foreground" aria-hidden>×</span>
                <PackageOpen size={18} className="text-muted-foreground" aria-hidden />
              </p>
            </div>
            {hasOffer ? (
              /* Price card — same footprint, split into two equal halves: carton (left) / offer (right) */
              <div className="rounded-xl bg-accent/10 border border-accent/20 text-center col-span-2 sm:col-span-1 grid grid-cols-2">
                <div className="p-4 order-1 border-r border-accent/20">
                  <p className="text-xs text-muted-foreground mb-1">سعر الكرتون</p>
                  <p className="text-xl font-extrabold text-accent">
                    ₪{Number(product.cartonPrice).toLocaleString('en-US')}
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">سعر العرض</p>
                  <p className="text-xl font-extrabold text-accent">
                    ₪{Number(product.offerPrice).toLocaleString('en-US')}
                  </p>
                  {(product.offerQuantity > 0 || product.bonusQuantity > 0) && (
                    <p
                      dir="ltr"
                      className="text-[10px] font-medium text-muted-foreground leading-tight mt-0.5 flex items-center justify-center gap-0.5"
                    >
                      <span>{Number(product.offerQuantity).toLocaleString('en-US')}</span>
                      <span aria-hidden>×</span>
                      <PackageOpen size={11} className="shrink-0" aria-hidden />
                      {product.bonusQuantity > 0 && (
                        <>
                          <span className="mx-0.5" aria-hidden>+</span>
                          <span>{Number(product.bonusQuantity).toLocaleString('en-US')}</span>
                          <PackageOpen size={11} className="shrink-0 text-accent" aria-hidden />
                        </>
                      )}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* No offer → one full-width carton-price cell instead of a split card with a dash */
              <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 text-center col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground mb-1">سعر الكرتون</p>
                <p className="text-xl font-extrabold text-accent">
                  ₪{Number(product.cartonPrice).toLocaleString('en-US')}
                </p>
              </div>
            )}
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
