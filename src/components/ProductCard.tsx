import { Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Package, Plus, Check, BadgePercent } from 'lucide-react';
import type { Product } from '@/types/product';
import { resolveThumbUrl } from '@/api/client';
import { getOfferInfo, offerPriceText, offerQuantityText } from '@/lib/offer';
import { useDisplayPrefs, FONT_CLASSES } from '@/lib/display-prefs';

interface ProductCardProps {
  product: Product;
  index: number;
  /** Effective price visibility (admin's global switch AND the device choice). */
  showPrice: boolean;
  /** Admin-configured image for products without their own ('' = none). */
  defaultImageUrl: string;
  /**
   * Ordered ids of the products currently on screen (filters + search applied).
   * Carried in history state so the detail page swipes within this exact list.
   */
  catalogIds: string[];
  /**
   * Picker mode (presentation builder add-mode): when provided, the card taps to
   * add/remove instead of navigating, and shows a +/✓ affordance. Same visual as
   * the catalog so the rep never feels they left it.
   */
  onAdd?: () => void;
  added?: boolean;
}

export function ProductCard({ product, index, showPrice, defaultImageUrl, catalogIds, onAdd, added }: ProductCardProps) {
  const { prefs } = useDisplayPrefs();
  const font = FONT_CLASSES[prefs.fontScale];
  const pickerMode = typeof onAdd === 'function';
  // Offer derived from the real product fields (see lib/offer.ts) — the SINGLE
  // source of truth shared with the product detail. The card surfaces the offer
  // price (سعر العرض) as a real price and the quantity/bonus line beneath it,
  // using the exact same gate (offer.hasOffer) and formatter as the detail.
  const offer = getOfferInfo(product);

  // A product without its own image falls back to the admin's default image.
  const fullUrl = product.imageUrl || defaultImageUrl;
  // Catalog uses the lightweight thumbnail; if it's missing (e.g. a legacy
  // image uploaded before thumbnails existed), fall back to the full image.
  const thumbUrl = fullUrl ? resolveThumbUrl(fullUrl) : '';

  const body = (
    <>
      {/* Image — fixed 4:3 frame; the image adapts to the frame, never the reverse */}
      <div className="relative aspect-[4/3] shrink-0 bg-muted overflow-hidden">
        {fullUrl ? (
          <img
            src={thumbUrl}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              // Thumbnail missing → fall back to the full image (guard against loops).
              if (e.currentTarget.src !== fullUrl) {
                e.currentTarget.src = fullUrl;
              }
            }}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-400"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-muted-foreground">
            <Package size={48} strokeWidth={1} aria-hidden />
          </div>
        )}
        {/* Category badge */}
        <span className={`absolute top-2 right-2 px-2.5 py-1 rounded-full font-medium bg-background/90 text-foreground shadow-sm backdrop-blur-sm ${font.cardBadge}`}>
          {product.category}
        </span>
        {/* Picker add/added indicator (mirrors the category badge, opposite corner) */}
        {pickerMode && (
          <span
            className={`absolute top-2 left-2 flex items-center justify-center w-8 h-8 rounded-full shadow-sm transition-colors ${
              added ? 'bg-accent text-accent-foreground' : 'bg-background/90 text-foreground'
            }`}
            aria-hidden
          >
            {added ? <Check size={16} /> : <Plus size={16} />}
          </span>
        )}
      </div>

      {/* Content — description space is always reserved (em-based, so it scales
          with the font preference) so every card keeps identical dimensions */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className={`font-bold text-foreground leading-tight mb-1 line-clamp-1 ${font.cardName}`}>
          {product.name}
        </h3>
        <p className={`text-muted-foreground leading-relaxed mb-3 line-clamp-2 min-h-[3.25em] ${font.cardDesc}`}>
          {product.description || ' '}
        </p>
        <div className="mt-auto space-y-1.5">
          {/* Size chip + carton price (the primary financial element). The
              "سعر الكرتونة" label sits above the number, aligned to the size
              chip's baseline so the row height barely grows. */}
          <div className="flex items-end justify-between gap-2 min-h-7">
            {product.size ? (
              <span className="self-center text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                {product.size}
              </span>
            ) : (
              <span aria-hidden />
            )}
            {showPrice && (
              <span className="text-left leading-tight shrink-0">
                <span className="block text-[10px] font-medium text-muted-foreground">سعر الكرتونة</span>
                <span className={`block font-extrabold text-accent ${font.cardPrice}`}>
                  ₪{Number(product.cartonPrice).toLocaleString('en-US')}
                </span>
              </span>
            )}
          </div>
          {/* Offer — shown ONLY when there is a real offer (a special price and/or
              a complete "X + Y بونص" deal), never as an empty box. When a special
              price exists it reads as a real price (سعر العرض ₪x) with the
              quantity/bonus line beneath; a bonus-only deal stays a single compact
              row. Same gate + formatter as the product detail. */}
          {showPrice && offer.hasOffer && (
            <div className="rounded-lg bg-accent/10 border border-accent/20 px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                  <BadgePercent size={13} className="text-accent shrink-0" aria-hidden />
                  {offer.hasOfferPrice ? 'سعر العرض' : 'العرض'}
                </span>
                {offer.hasOfferPrice ? (
                  <span className={`font-extrabold text-accent leading-none ${font.cardPrice}`}>
                    {offerPriceText(offer)}
                  </span>
                ) : (
                  /* Bonus-only deal → the "X + Y بونص" text takes the price slot. */
                  <span
                    dir="ltr"
                    className={`font-bold text-accent leading-none whitespace-nowrap ${font.cardOffer}`}
                  >
                    {offerQuantityText(offer)}
                  </span>
                )}
              </div>
              {/* Quantity/bonus line beneath the offer price (omitted when there's
                  nothing complete to show — e.g. an offer price with no quantity). */}
              {offer.hasOfferPrice && offerQuantityText(offer) && (
                <p
                  dir="ltr"
                  className={`text-left font-semibold text-accent/90 leading-tight mt-0.5 whitespace-nowrap ${font.cardOffer}`}
                >
                  {offerQuantityText(offer)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );

  const shell = `group flex flex-col h-full rounded-2xl bg-card border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98] ${
    added ? 'border-accent ring-2 ring-accent/40' : 'border-border'
  }`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 10) * 0.06 }}
      className="h-full"
    >
      {pickerMode ? (
        <button
          type="button"
          onClick={onAdd}
          aria-pressed={added}
          aria-label={added ? `إزالة ${product.name} من العرض` : `إضافة ${product.name} إلى العرض`}
          className={`${shell} w-full text-right`}
          dir="rtl"
        >
          {body}
        </button>
      ) : (
        <Link
          to="/product/$id"
          params={{ id: product.id }}
          state={{ catalogIds }}
          className={shell}
          dir="rtl"
        >
          {body}
        </Link>
      )}
    </motion.div>
  );
}
