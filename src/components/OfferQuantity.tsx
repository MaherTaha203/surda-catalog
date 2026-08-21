import type { OfferInfo } from '@/lib/offer';
import { offerQuantityParts } from '@/lib/offer';

/**
 * The offer quantity/bonus line ("10 + 1 بونص" / "10 كرتون") — the ONE shared
 * renderer used by both the catalog card and the product detail, so the two
 * surfaces can never diverge in wording, digits, or direction.
 *
 * Bidirectionality: the phrase reads in Arabic order (right→left) as
 * "10 + 1 بونص" — the quantity first, then the bonus, then the word. The numeric
 * expression is kept in Western digits and math order inside an LTR <bdi> isolate
 * so RTL layout can never reorder "10 + 1" into "1 + 10"; the Arabic unit word
 * (بونص / كرتون) sits after it in the surrounding RTL flow. Renders nothing when
 * there is no complete quantity to show.
 */
export function OfferQuantity({ offer, className }: { offer: OfferInfo; className?: string }) {
  const parts = offerQuantityParts(offer);
  if (!parts) return null;
  // The number ("12 + 1") never breaks apart (bdi + nowrap keeps its LTR order
  // intact); the unit word is separated by a normal, breakable space. A caller
  // that wants the whole phrase on one line passes `whitespace-nowrap` (the card);
  // one that allows wrapping (the detail's narrow price cell) breaks cleanly
  // BEFORE the word — "12 + 1" / "بونص" — never mid-expression.
  return (
    <span dir="rtl" className={className}>
      <bdi dir="ltr" className="whitespace-nowrap">{parts.num}</bdi>{' '}{parts.unit}
    </span>
  );
}
