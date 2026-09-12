/**
 * Product Sheet — a single-product, print-ready A4 document.
 *
 * This is the ONE source rendered both for the on-screen preview and for the
 * captured PDF / image output (html2canvas), so what the user sees is exactly
 * what prints — a WYSIWYG guarantee identical to the Presentation Builder.
 *
 * It is a fixed white document with explicit colors (never the app's semantic
 * tokens), so a generated sheet looks the same whether the app is in light or
 * night mode. It surfaces EVERY product field the catalog stores — image,
 * category, name, description, size, carton quantity, carton price, offer
 * price, and the full offer/bonus deal — framed by the shared Company Profile
 * (logo, name, tagline, contact, date), so a single sheet is a complete,
 * professional product spec on paper.
 */
import { forwardRef } from 'react';
import type { Product } from '@/types/product';
import type { CompanyProfile } from '@/hooks/useCompanyProfile';
import { resolveImageUrl } from '@/api/client';
import {
  getOfferInfo,
  offerPriceText,
  offerQuantityText,
  CARTON_UNIT,
} from '@/lib/offer';

/** Portrait A4 render size in px (mm ratio 297/210). Scale applied by caller. */
export const SHEET_WIDTH = 820;
export const SHEET_HEIGHT = Math.round(SHEET_WIDTH * (297 / 210));

/** Fixed brand palette — mirrors the Presentation Builder for a consistent look. */
const BRAND = {
  teal: 'hsl(200 50% 30%)',
  tealSoft: 'hsl(200 45% 96%)',
  amber: 'hsl(35 80% 42%)',
  amberSoft: 'hsl(35 85% 96%)',
  ink: 'hsl(220 25% 18%)',
  muted: 'hsl(220 12% 45%)',
  line: 'hsl(220 14% 88%)',
  panel: 'hsl(220 20% 98%)',
  white: '#ffffff',
} as const;

function money(n: number): string {
  return `₪${Number(n).toLocaleString('en-US')}`;
}

interface SpecProps {
  label: string;
  value: string;
  accent?: 'teal' | 'amber';
  strike?: string;
}

/** One labelled specification cell in the details grid. */
function Spec({ label, value, accent, strike }: SpecProps) {
  const valueColor = accent === 'amber' ? BRAND.amber : accent === 'teal' ? BRAND.teal : BRAND.ink;
  const bg = accent === 'amber' ? BRAND.amberSoft : accent === 'teal' ? BRAND.tealSoft : BRAND.panel;
  const border = accent === 'amber' ? 'hsl(35 70% 82%)' : accent === 'teal' ? 'hsl(200 40% 82%)' : BRAND.line;
  return (
    <div
      style={{
        border: `1px solid ${border}`,
        background: bg,
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, color: BRAND.muted, fontWeight: 600 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: accent ? 22 : 18, fontWeight: 800, color: valueColor, lineHeight: 1.15 }}>
          {value}
        </span>
        {strike && (
          <span style={{ fontSize: 14, color: BRAND.muted, textDecoration: 'line-through' }}>{strike}</span>
        )}
      </div>
    </div>
  );
}

export interface ProductSheetProps {
  product: Product;
  company: CompanyProfile;
  /** Whether prices may be shown at all (admin/pref gated by the caller). */
  showPrices: boolean;
  /** Fallback image when the product has none. */
  defaultImageUrl: string;
  /** Localized sheet date (already formatted by the caller). */
  dateLabel: string;
}

/**
 * The printable product sheet. Rendered off-screen by the actions component and
 * captured to PDF/PNG. `data-product-sheet` marks the capture root.
 */
export const ProductSheet = forwardRef<HTMLDivElement, ProductSheetProps>(function ProductSheet(
  { product, company, showPrices, defaultImageUrl, dateLabel },
  ref,
) {
  const offer = getOfferInfo(product);
  const img = product.imageUrl || defaultImageUrl;
  const cartonQty = Number(product.cartonQuantity) || 0;
  const cartonPrice = Number(product.cartonPrice) || 0;

  const contactBits = [
    company.phone,
    company.whatsapp && `واتساب ${company.whatsapp}`,
    company.email,
    company.website,
    company.address,
  ]
    .filter(Boolean)
    .join('  ·  ');

  // Offer/bonus line (e.g. "10 كرتونة + 1 كرتونة بونص") — only when complete.
  const offerLine = offerQuantityText(offer);

  return (
    <div
      ref={ref}
      dir="rtl"
      data-product-sheet=""
      style={{
        width: SHEET_WIDTH,
        height: SHEET_HEIGHT,
        background: BRAND.white,
        color: BRAND.ink,
        fontFamily: 'Tajawal, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        padding: 40,
        boxSizing: 'border-box',
      }}
    >
      {/* Header — company identity + sheet meta */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          paddingBottom: 16,
          marginBottom: 24,
          borderBottom: `3px solid ${BRAND.teal}`,
        }}
      >
        {company.logo && (
          <img
            src={company.logo}
            alt=""
            crossOrigin="anonymous"
            style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {company.name && <div style={{ fontWeight: 800, fontSize: 22, color: BRAND.teal }}>{company.name}</div>}
          {company.tagline && <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 2 }}>{company.tagline}</div>}
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: BRAND.ink }}>بطاقة منتج</div>
          {dateLabel && <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>{dateLabel}</div>}
        </div>
      </div>

      {/* Hero image */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 320,
          background: BRAND.panel,
          border: `1px solid ${BRAND.line}`,
          borderRadius: 16,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {img ? (
          <img
            src={resolveImageUrl(img)}
            alt={product.name}
            crossOrigin="anonymous"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : null}
        <span
          style={{
            position: 'absolute',
            top: 12,
            insetInlineEnd: 12,
            fontSize: 13,
            fontWeight: 700,
            background: 'rgba(255,255,255,0.92)',
            color: BRAND.teal,
            padding: '4px 12px',
            borderRadius: 999,
            border: `1px solid ${BRAND.line}`,
          }}
        >
          {product.category}
        </span>
      </div>

      {/* Title + description */}
      <div style={{ marginTop: 22 }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: BRAND.ink, lineHeight: 1.25 }}>
          {product.name}
        </h1>
        {product.description && (
          <p
            style={{
              margin: '12px 0 0',
              fontSize: 15,
              lineHeight: 1.7,
              color: BRAND.muted,
              whiteSpace: 'pre-line',
            }}
          >
            {product.description}
          </p>
        )}
      </div>

      {/* Specifications grid — every stored field surfaced */}
      <div
        style={{
          marginTop: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 14,
        }}
      >
        {product.size && <Spec label="الحجم / الوزن" value={product.size} />}
        {cartonQty > 0 && (
          <Spec label="الكمية في الكرتون" value={`${cartonQty.toLocaleString('en-US')} ${CARTON_UNIT}`} />
        )}
        {showPrices && cartonPrice > 0 && (
          <Spec label="سعر الكرتون" value={money(cartonPrice)} accent="teal" />
        )}
        {showPrices && offer.hasOfferPrice && (
          <Spec
            label="سعر العرض"
            value={offerPriceText(offer)}
            accent="amber"
            strike={cartonPrice > 0 ? money(cartonPrice) : undefined}
          />
        )}
      </div>

      {/* Offer / bonus banner — the complete deal, spelled out */}
      {showPrices && offerLine && (
        <div
          style={{
            marginTop: 14,
            background: BRAND.amber,
            color: BRAND.white,
            borderRadius: 12,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>العرض</span>
          <span style={{ fontSize: 18, fontWeight: 800 }}>{offerLine}</span>
        </div>
      )}

      {/* Spacer pushes the footer to the bottom of the sheet */}
      <div style={{ flex: 1 }} />

      {/* Footer — contact + brand line */}
      <div
        style={{
          marginTop: 24,
          paddingTop: 14,
          borderTop: `1px solid ${BRAND.line}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          fontSize: 12,
          color: BRAND.muted,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>{contactBits}</div>
        {company.name && <div style={{ whiteSpace: 'nowrap', fontWeight: 700, color: BRAND.teal }}>{company.name}</div>}
      </div>
    </div>
  );
});
