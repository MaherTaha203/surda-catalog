import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createFileRoute,
  useParams,
  useNavigate,
  useRouter,
  useCanGoBack,
  useLocation,
} from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Package, PackageOpen, ZoomIn } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProduct } from '@/api/products';
import { readProductsSnapshot } from '@/lib/offline-db';
import { fetchProducts, PRODUCTS_KEY, productsInitialData } from '@/hooks/useProducts';
import { useCatalogSettings } from '@/hooks/useCatalogSettings';
import { useDisplayPrefs, effectiveShowPrices, FONT_CLASSES } from '@/lib/display-prefs';
import { ImageViewer } from '@/components/ImageViewer';
import { resolveThumbUrl, fullImageCandidates } from '@/api/client';
import { useImageFallback } from '@/hooks/useImageFallback';
import { getOfferInfo, offerPriceText, offerQuantityText } from '@/lib/offer';
import type { Product } from '@/types/product';
// [notifications-feature] EXPERIMENTAL — remove this import, the validateSearch
// `notif` field, and the <NotificationSourceBar/> block below to delete the feature.
import { NotificationSourceBar } from '@/features/notifications';

async function fetchProduct(id: string): Promise<Product | null> {
  try {
    // Loads from the Fastify API (getProduct returns null on a 404).
    return await getProduct(id);
  } catch {
    // API unavailable → fall back to the local snapshot (populated by the
    // catalog). Snapshot products already carry display-ready image URLs.
    return readProductsSnapshot().find((p) => p.id === id) ?? null;
  }
}

export const Route = createFileRoute('/product/$id')({
  head: () => ({
    meta: [{ title: `تفاصيل المنتج — سردا` }],
  }),
  // [notifications-feature] EXPERIMENTAL — optional `?notif=<id>` tags the page as
  // opened from a notification. Absent on every normal catalog navigation.
  validateSearch: (search: Record<string, unknown>): { notif?: string } => {
    const notif = typeof search.notif === 'string' ? search.notif : undefined;
    return notif ? { notif } : {};
  },
  component: ProductDetailPage,
});

// Page-level product swipe must be deliberate — identical philosophy to the
// image viewer, with the page's own thresholds from the spec.
const SWIPE_MIN_DISTANCE = 80; // px
const SWIPE_MIN_VELOCITY = 0.3; // px/ms
const SWIPE_HORIZONTAL_DOMINANCE = 2; // |dx| ≥ |dy| * 2

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
  // [notifications-feature] EXPERIMENTAL — set only when opened from a notification.
  const { notif } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const queryClient = useQueryClient();
  const [viewerOpen, setViewerOpen] = useState(false);
  // Which way the last product navigation went — drives the slide direction.
  const [slideDir, setSlideDir] = useState<1 | -1>(1);

  const settings = useCatalogSettings();
  const { prefs } = useDisplayPrefs();
  const font = FONT_CLASSES[prefs.fontScale];
  const showPrices = effectiveShowPrices(settings, prefs);

  // The exact list the user was browsing (category filter + search + admin
  // order), carried in history state from the catalog card they tapped.
  const catalogIds = useLocation({ select: (l) => l.state.catalogIds });

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

  // Shares the catalog's query (same key + fetcher), so it's a cache hit when
  // arriving from the catalog and a single list fetch on deep links.
  const { data: allProducts } = useQuery({
    queryKey: PRODUCTS_KEY,
    queryFn: fetchProducts,
    // Same local-first seed as the catalog, so swiping between products (and
    // deep links) works offline without waiting on the network.
    initialData: productsInitialData,
    staleTime: 30_000,
  });
  const defaultImage = settings.defaultProductImageUrl;

  // Navigation pool: the filtered catalog view when we have it, otherwise all
  // visible products in admin order (deep links).
  const orderedProducts = useMemo(() => {
    const visible = (allProducts ?? []).filter((p) => Number(p.isHidden) === 0);
    if (catalogIds?.length) {
      const byId = new Map(visible.map((p) => [p.id, p]));
      const scoped = catalogIds.map((pid) => byId.get(pid)).filter((p): p is Product => Boolean(p));
      // The current product must be in the pool for prev/next to make sense.
      if (scoped.some((p) => p.id === id)) return scoped;
    }
    return visible;
  }, [allProducts, catalogIds, id]);

  const pageIndex = orderedProducts.findIndex((p) => p.id === id);
  const pagePrev = pageIndex > 0 ? orderedProducts[pageIndex - 1] : undefined;
  const pageNext = pageIndex >= 0 ? orderedProducts[pageIndex + 1] : undefined;

  // The viewer can only show products with something to display.
  const viewerSiblings = useMemo(
    () => orderedProducts.filter((p) => p.imageUrl || defaultImage),
    [orderedProducts, defaultImage],
  );
  const viewerIndex = viewerSiblings.findIndex((p) => p.id === id);
  const viewerPrev = viewerIndex > 0 ? viewerSiblings[viewerIndex - 1] : undefined;
  const viewerNext = viewerIndex >= 0 ? viewerSiblings[viewerIndex + 1] : undefined;

  // Swap the product in place. `replace` keeps history clean (back returns to
  // the catalog, not through every swipe), `state: true` carries the filtered
  // list forward, and `resetScroll: false` keeps the current scroll position.
  const goToProduct = (target: Product | undefined, direction: 1 | -1) => {
    if (!target) return;
    setSlideDir(direction);
    navigate({
      to: '/product/$id',
      params: { id: target.id },
      replace: true,
      resetScroll: false,
      state: true,
    });
  };

  const handlePageNavigate = (direction: 1 | -1) =>
    goToProduct(direction === 1 ? pageNext : pagePrev, direction);
  const handleViewerNavigate = (direction: 1 | -1) =>
    goToProduct(direction === 1 ? viewerNext : viewerPrev, direction);

  // Desktop keyboard: arrows switch products (RTL: left = next). While the
  // viewer is open it owns the arrow keys — don't double-navigate.
  const keyState = useRef({ viewerOpen, handlePageNavigate });
  keyState.current = { viewerOpen, handlePageNavigate };
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (keyState.current.viewerOpen) return;
      if (e.key === 'ArrowLeft') keyState.current.handlePageNavigate(1);
      else if (e.key === 'ArrowRight') keyState.current.handlePageNavigate(-1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Deliberate swipe on the page body (mobile/tablet). One finger only —
  // a second touch (pinch/browser zoom) poisons the gesture, and while the
  // page is pinch-zoomed navigation is disabled entirely.
  const swipeStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const pinchedDuringGesture = useRef(false);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 1) {
      swipeStart.current = null;
      pinchedDuringGesture.current = true;
      return;
    }
    pinchedDuringGesture.current = false;
    swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() };
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 1) {
      swipeStart.current = null;
      pinchedDuringGesture.current = true;
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || pinchedDuringGesture.current || viewerOpen) return;
    if (e.touches.length > 0) return;
    if ((window.visualViewport?.scale ?? 1) > 1) return; // page is zoomed → pan only
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const elapsed = Math.max(1, performance.now() - start.t);
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return;
    if (Math.abs(dx) / elapsed < SWIPE_MIN_VELOCITY) return;
    if (Math.abs(dx) < Math.abs(dy) * SWIPE_HORIZONTAL_DOMINANCE) return;
    if (dx < 0) handlePageNavigate(1); // swipe left → next
    else handlePageNavigate(-1); // swipe right → previous
  };

  // Preload the neighbors so navigation feels instant: warm the product query
  // and decode the images ahead of time.
  useEffect(() => {
    for (const neighbor of [pagePrev, pageNext]) {
      if (!neighbor) continue;
      queryClient.prefetchQuery({
        queryKey: ['product', neighbor.id],
        queryFn: () => fetchProduct(neighbor.id),
        staleTime: 30_000,
      });
      const src = neighbor.imageUrl || defaultImage;
      if (src) {
        const img = new Image();
        img.src = src;
        const thumb = resolveThumbUrl(src);
        if (thumb && thumb !== src) new Image().src = thumb;
      }
    }
  }, [pagePrev, pageNext, defaultImage, queryClient]);

  // Hero image with a resilient source chain: full → thumbnail → clean
  // placeholder. The grid usually already warmed the thumbnail in cache, so a
  // full image that is missing on the server or not yet cached never shows the
  // browser's broken-image marker (which also leaks the alt text over the badge).
  // Computed here — before the early returns — so the hook order stays stable.
  const effectiveImage = product?.imageUrl || defaultImage;
  const heroCandidates = useMemo(() => fullImageCandidates(effectiveImage), [effectiveImage]);
  const heroImage = useImageFallback(heroCandidates);

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

  // Same offer derivation as the catalog card (single source of truth): an offer
  // is a special carton price and/or a complete "buy X get Y bonus" deal.
  const offer = getOfferInfo(product);
  const hasOffer = offer.hasOffer;
  // The one quantity/bonus line ("10 + 2 بونص" or "10 كرتون"), identical to the card.
  const offerQty = offerQuantityText(offer);

  return (
    <div className="min-h-dvh bg-background" dir="rtl">
      <PageHeader onBack={goBack} />

      {/* [notifications-feature] EXPERIMENTAL — shown only when opened from a notification. */}
      {notif && (
        <div className="max-w-3xl mx-auto px-4 pt-3">
          <NotificationSourceBar notifId={notif} />
        </div>
      )}

      {/* overflow-x-hidden clips the horizontal slide — no page-level scrollbar */}
      <div
        className="max-w-3xl mx-auto px-4 py-4 overflow-x-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* The whole product view slides out/in when swiping between products.
            initial={false}: arriving from the catalog renders without a slide. */}
        <AnimatePresence mode="popLayout" initial={false} custom={slideDir}>
          <motion.div
            key={product.id}
            custom={slideDir}
            variants={{
              enter: (d: 1 | -1) => ({ x: d * 90, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: 1 | -1) => ({ x: d * -90, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {/* Product image */}
            <button
              type="button"
              disabled={!heroImage.src}
              onClick={() => setViewerOpen(true)}
              aria-label="عرض الصورة بالحجم الكامل"
              className="group relative block w-full aspect-[4/3] rounded-2xl bg-muted overflow-hidden shadow-md disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {heroImage.src ? (
                <img
                  src={heroImage.src}
                  alt={product.name}
                  decoding="async"
                  fetchPriority="high"
                  onError={heroImage.onError}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                  <Package size={64} strokeWidth={1} aria-hidden />
                </div>
              )}
              {heroImage.src && (
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
              <span className={`absolute top-2 right-2 px-3 py-1 rounded-full font-medium bg-background/90 text-foreground shadow-sm ${font.detailBadge}`}>
                {product.category}
              </span>
            </button>

            {/* Product info */}
            <div className="mt-6 space-y-4">
              <h1 className={`font-bold text-foreground ${font.detailName}`}>{product.name}</h1>

              {product.description && (
                <p className={`text-muted-foreground leading-relaxed whitespace-pre-line ${font.detailDesc}`}>
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
                {showPrices &&
                  (hasOffer ? (
                    /* Price card — same footprint, split into two equal halves: carton (left) / offer (right) */
                    <div className="rounded-xl bg-accent/10 border border-accent/20 text-center col-span-2 sm:col-span-1 grid grid-cols-2">
                      <div className="p-4 order-1 border-r border-accent/20">
                        <p className="text-xs text-muted-foreground mb-1">سعر الكرتون</p>
                        <p className={`font-extrabold text-accent ${font.detailPrice}`}>
                          ₪{Number(product.cartonPrice).toLocaleString('en-US')}
                        </p>
                      </div>
                      <div className="p-4">
                        {offer.hasOfferPrice ? (
                          <>
                            <p className="text-xs text-muted-foreground mb-1">سعر العرض</p>
                            <p className={`font-extrabold text-accent ${font.detailPrice}`}>
                              {offerPriceText(offer)}
                            </p>
                            {/* Quantity/bonus line — same "10 + 2 بونص" / "10 كرتون"
                                text as the card; omitted when there's nothing
                                complete to show (an offer price with no quantity). */}
                            {offerQty && (
                              <p
                                dir="ltr"
                                className={`font-semibold text-accent/90 leading-tight mt-0.5 ${font.detailOffer}`}
                              >
                                {offerQty}
                              </p>
                            )}
                          </>
                        ) : (
                          /* Bonus-only deal (free units at the regular price) — no سعر عرض. */
                          <>
                            <p className="text-xs text-muted-foreground mb-1">العرض</p>
                            <p dir="ltr" className={`font-extrabold text-accent ${font.detailPrice}`}>
                              {offerQty}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* No offer → one full-width carton-price cell instead of a split card with a dash */
                    <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 text-center col-span-2 sm:col-span-1">
                      <p className="text-xs text-muted-foreground mb-1">سعر الكرتون</p>
                      <p className={`font-extrabold text-accent ${font.detailPrice}`}>
                        ₪{Number(product.cartonPrice).toLocaleString('en-US')}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Image viewer */}
      {heroImage.src && (
        <ImageViewer
          src={effectiveImage}
          alt={product.name}
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          onNavigate={handleViewerNavigate}
          hasNext={Boolean(viewerNext)}
          hasPrev={Boolean(viewerPrev)}
        />
      )}
    </div>
  );
}
