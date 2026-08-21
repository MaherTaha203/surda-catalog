import { Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Package, Plus, Check, BadgePercent } from 'lucide-react';
import type { Product } from '@/types/product';
import { resolveThumbUrl } from '@/api/client';
import { getOfferInfo, offerPriceText, offerQuantityParts } from '@/lib/offer';
import { OfferQuantity } from '@/components/OfferQuantity';
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
        {/* Picker add/added indicator (top corner, only in the presentation builder) */}
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

      {/* Content — the card shows the FULL product name (no truncation) and no
          description; the description lives on the product detail page. The price
          block is pinned to the bottom (mt-auto) so it stays aligned across a row
          regardless of how many lines the name takes. */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className={`font-bold text-foreground leading-snug break-words mb-3 ${font.cardName}`}>
          {product.name}
        </h3>
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
              a complete bonus deal), never as an empty box. Layout: the offer
              price is the headline on the right; the quantity/bonus sits beside it
              on the left as a filled accent CHIP ("10 كرتونة + 2 كرتونة بونص"), so
              the two read side by side and fill the width. Same gate + renderer as
              the product detail. */}
          {showPrice && offer.hasOffer && (
            <div className={`rounded-lg bg-accent/10 border border-accent/20 px-2.5 py-1.5 flex items-center gap-2 ${offerQuantityParts(offer) ? 'justify-between' : 'justify-center'}`}>
              <div className="text-right leading-tight shrink-0">
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                  <BadgePercent size={13} className="text-accent shrink-0" aria-hidden />
                  {offer.hasOfferPrice ? 'سعر العرض' : 'العرض'}
                </span>
                {offer.hasOfferPrice && (
                  <span className={`block font-extrabold text-accent leading-none mt-0.5 ${font.cardPrice}`}>
                    {offerPriceText(offer)}
                  </span>
                )}
              </div>
              {offerQuantityParts(offer) && (
                <OfferQuantity
                  offer={offer}
                  className={`rounded-lg bg-accent text-accent-foreground px-2 py-1 font-bold text-center leading-snug shadow-sm ${font.cardOffer}`}
                />
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
