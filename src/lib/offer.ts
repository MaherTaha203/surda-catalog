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
  /** A special offer price is set (سعر العرض > 0). Drives the detail price card. */
  hasOfferPrice: boolean;
  /** Any quantity/bonus figure to show (used by the detail's offer line). */
  hasBonusInfo: boolean;
  /** A complete "X + Y مجاناً" deal (both figures present) — the catalog card badge. */
  hasBonusDeal: boolean;
}

export function getOfferInfo(
  p: Pick<Product, 'offerPrice' | 'offerQuantity' | 'bonusQuantity'>,
): OfferInfo {
  const offerPrice = Number(p.offerPrice) || 0;
  const offerQuantity = Number(p.offerQuantity) || 0;
  const bonusQuantity = Number(p.bonusQuantity) || 0;
  return {
    offerPrice,
    offerQuantity,
    bonusQuantity,
    hasOfferPrice: offerPrice > 0,
    hasBonusInfo: offerQuantity > 0 || bonusQuantity > 0,
    hasBonusDeal: offerQuantity > 0 && bonusQuantity > 0,
  };
}
