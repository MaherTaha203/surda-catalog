/**
 * Offer derivation — a single, pure reading of the EXISTING product fields
 * (offerPrice / offerQuantity / bonusQuantity). No new storage, no parallel
 * data model: every surface (catalog card + product detail) derives its offer
 * display from here so the "what counts as an offer" rule lives in one place.
 *
 *   offerPrice     (سعر العرض)      — a special carton price during the offer
 *   offerQuantity  (كمية العرض)     — cartons bought in the deal
 *   bonusQuantity  (البونص/المجاني) — cartons given free with that quantity
 */
import type { Product } from '@/types/product';

export interface OfferInfo {
  offerPrice: number;
  offerQuantity: number;
  bonusQuantity: number;
  /** A special offer price is set (سعر العرض > 0). Shows the "سعر العرض ₪x" price. */
  hasOfferPrice: boolean;
  /** Any quantity/bonus figure is present (offerQuantity or bonusQuantity > 0). */
  hasBonusInfo: boolean;
  /** A complete "X + Y بونص" deal (both figures present). */
  hasBonusDeal: boolean;
  /**
   * There is a REAL offer worth surfacing: a special price, and/or a complete
   * bonus deal. This is the one gate both the card and the detail use to decide
   * whether to render any offer UI at all — so an incomplete figure (a lone
   * quantity, or a lone bonus with no price) never paints an empty/misleading box.
   */
  hasOffer: boolean;
}

export function getOfferInfo(
  p: Pick<Product, 'offerPrice' | 'offerQuantity' | 'bonusQuantity'>,
): OfferInfo {
  const offerPrice = Number(p.offerPrice) || 0;
  const offerQuantity = Number(p.offerQuantity) || 0;
  const bonusQuantity = Number(p.bonusQuantity) || 0;
  const hasOfferPrice = offerPrice > 0;
  const hasBonusDeal = offerQuantity > 0 && bonusQuantity > 0;
  return {
    offerPrice,
    offerQuantity,
    bonusQuantity,
    hasOfferPrice,
    hasBonusInfo: offerQuantity > 0 || bonusQuantity > 0,
    hasBonusDeal,
    hasOffer: hasOfferPrice || hasBonusDeal,
  };
}

/** Western-digit number format — matches the carton-price formatting app-wide. */
const fmt = (n: number): string => Number(n).toLocaleString('en-US');

/** The offer price rendered as a price string (e.g. "₪83"), or '' when none. */
export function offerPriceText(offer: OfferInfo): string {
  return offer.hasOfferPrice ? `₪${fmt(offer.offerPrice)}` : '';
}

export interface OfferQuantityParts {
  /** Numeric expression in Western digits, math order — e.g. "10 + 1" or "10". */
  num: string;
  /** Arabic unit word that follows the number — "بونص" or "كرتون". */
  unit: string;
}

/**
 * The offer quantity/bonus split into its number + unit word, so a renderer can
 * lay it out with correct bidirectionality: the Western digits stay in math
 * order and the Arabic word follows them, the whole reading right→left in Arabic
 * as "10 + 1 بونص".
 *   • complete bonus deal → { num: "10 + 1", unit: "بونص" }
 *   • offer price with a quantity, no bonus → { num: "10", unit: "كرتون" }
 *   • anything else → null (nothing complete to show)
 * Quantities are whole cartons, so the numbers are plain Western digits (never
 * localized/grouped) — no chance of Arabic-Indic digits slipping in.
 */
export function offerQuantityParts(offer: OfferInfo): OfferQuantityParts | null {
  if (offer.hasBonusDeal) return { num: `${offer.offerQuantity} + ${offer.bonusQuantity}`, unit: 'بونص' };
  if (offer.hasOfferPrice && offer.offerQuantity > 0) return { num: `${offer.offerQuantity}`, unit: 'كرتون' };
  return null;
}

/**
 * The flat "10 + 1 بونص" string in logical/reading order — for aria labels,
 * tests, and any non-visual use. The visual surfaces render <OfferQuantity/>
 * instead, which lays the same parts out with correct RTL bidi.
 *
 * It never emits a bare "بونص", a "0 بونص", or an empty fragment: the term is
 * always paired with a real number, and an incomplete figure yields "".
 */
export function offerQuantityText(offer: OfferInfo): string {
  const parts = offerQuantityParts(offer);
  return parts ? `${parts.num} ${parts.unit}` : '';
}
