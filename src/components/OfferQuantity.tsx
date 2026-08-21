import type { OfferInfo } from '@/lib/offer';
import { offerQuantityParts, CARTON_UNIT } from '@/lib/offer';

/**
 * The offer quantity/bonus line — the ONE shared renderer used by both the
 * catalog card and the product detail, so the two surfaces can never diverge in
 * wording, digits, or direction.
 *
 * Reads in Arabic (right→left) as "10 كرتونة + 1 كرتونة بونص" (the quantity
 * first, then the bonus). Each Western number sits in its own LTR <bdi> isolate
 * so RTL layout can never reorder its digits or swap quantity with bonus; the
 * Arabic unit words (كرتونة / بونص) live in the surrounding RTL flow. A
 * quantity-only offer (no bonus) renders just "10 كرتونة". Renders nothing when
 * there is no complete quantity to show.
 */
export function OfferQuantity({ offer, className }: { offer: OfferInfo; className?: string }) {
  const parts = offerQuantityParts(offer);
  if (!parts) return null;
  // Each "<number> كرتونة" group is kept intact (whitespace-nowrap) so a narrow
  // container (the detail's split price cell) wraps BETWEEN the two groups —
  // "12 كرتونة" / "+ 1 كرتونة بونص" — never splitting a number from its unit.
  return (
    <span dir="rtl" className={className}>
      <span className="whitespace-nowrap">
        <bdi dir="ltr">{parts.quantity}</bdi> {CARTON_UNIT}
      </span>
      {parts.bonus !== null && (
        <>
          {' '}
          <span className="whitespace-nowrap">
            + <bdi dir="ltr">{parts.bonus}</bdi> {CARTON_UNIT} بونص
          </span>
        </>
      )}
    </span>
  );
}
