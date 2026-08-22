/**
 * Presentation Builder — one WYSIWYG page.
 *
 * This SAME component renders both the live preview and the source for PDF/image
 * generation (html2canvas), so what the rep sees is what they get. It is a fixed
 * white document (explicit colors, never the app's semantic tokens) so a
 * generated PDF looks identical whether the app is in light or night mode.
 */
import { forwardRef } from 'react';
import type { Product } from '@/types/product';
import { resolveImageUrl } from '@/api/client';
import type { CompanyProfile } from '@/hooks/useCompanyProfile';
import type { PdfSize, PresentationOptions, TemplateStyle } from './types';

/** Portrait page aspect ratio (height / width) per paper size. */
export const PAGE_RATIO: Record<PdfSize, number> = {
  A4: 297 / 210,
  A5: 210 / 148,
  Letter: 11 / 8.5,
};
/** Base render width in px (zoom/scale applied by the caller). */
export const PAGE_WIDTH = 820;

const BRAND = {
  teal: 'hsl(200 50% 30%)',
  tealSoft: 'hsl(200 45% 95%)',
  amber: 'hsl(35 80% 42%)',
  ink: 'hsl(220 25% 18%)',
  muted: 'hsl(220 12% 45%)',
  line: 'hsl(220 14% 88%)',
  white: '#ffffff',
};

export interface PageMeta {
  title: string;
  client: string;
  date: string;
  notes: string;
}

interface Props {
  products: Product[];
  pageIndex: number;
  pageCount: number;
  options: PresentationOptions;
  company: CompanyProfile;
  meta: PageMeta;
  showPrices: boolean;
  defaultImageUrl: string;
  pdfSize: PdfSize;
}

function gridShape(perPage: number): { cols: number } {
  return { cols: perPage <= 6 ? 2 : 3 };
}

function money(n: number): string {
  return `₪${Number(n).toLocaleString('en-US')}`;
}

function cardRadius(style: TemplateStyle): number {
  return style === 'classic' ? 6 : style === 'minimal' ? 4 : 14;
}

function ProductCell({
  product,
  options,
  showPrices,
  defaultImageUrl,
  compact,
}: {
  product: Product;
  options: PresentationOptions;
  showPrices: boolean;
  defaultImageUrl: string;
  compact: boolean;
}) {
  const { fields, style } = options;
  const img = product.imageUrl || defaultImageUrl;
  const canPrice = showPrices;
  const hasOffer = canPrice && fields.offerPrice && Number(product.offerPrice) > 0;
  const radius = cardRadius(style);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${BRAND.line}`,
        borderRadius: radius,
        overflow: 'hidden',
        background: BRAND.white,
        minHeight: 0,
      }}
    >
      {fields.image && (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', background: 'hsl(220 14% 96%)', flexShrink: 0 }}>
          {img ? (
            <img
              src={resolveImageUrl(img)}
              alt={product.name}
              crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : null}
          {fields.category && (
            <span
              style={{
                position: 'absolute',
                top: 6,
                insetInlineEnd: 6,
                fontSize: compact ? 9 : 11,
                background: 'rgba(255,255,255,0.9)',
                color: BRAND.ink,
                padding: '2px 8px',
                borderRadius: 999,
              }}
            >
              {product.category}
            </span>
          )}
        </div>
      )}
      <div style={{ padding: compact ? '6px 8px' : '10px 12px', display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        {fields.name && (
          <div style={{ fontWeight: 700, color: BRAND.ink, fontSize: compact ? 12 : 15, lineHeight: 1.3 }}>
            {product.name}
          </div>
        )}
        {fields.description && product.description && (
          <div style={{ color: BRAND.muted, fontSize: compact ? 10 : 12, lineHeight: 1.4 }}>
            {product.description}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 'auto' }}>
          {fields.size && product.size && (
            <span style={{ fontSize: compact ? 10 : 12, color: BRAND.muted, background: 'hsl(220 14% 95%)', padding: '1px 7px', borderRadius: 6 }}>
              {product.size}
            </span>
          )}
          {fields.cartonQuantity && Number(product.cartonQuantity) > 0 && (
            <span style={{ fontSize: compact ? 10 : 12, color: BRAND.muted }}>
              الكرتون: {product.cartonQuantity}
            </span>
          )}
        </div>
        {canPrice && (fields.cartonPrice || hasOffer) && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
            {hasOffer ? (
              <>
                <span style={{ fontWeight: 800, color: BRAND.amber, fontSize: compact ? 13 : 17 }}>{money(product.offerPrice)}</span>
                {fields.cartonPrice && Number(product.cartonPrice) > 0 && (
                  <span style={{ color: BRAND.muted, fontSize: compact ? 10 : 12, textDecoration: 'line-through' }}>
                    {money(product.cartonPrice)}
                  </span>
                )}
              </>
            ) : (
              fields.cartonPrice && Number(product.cartonPrice) > 0 && (
                <span style={{ fontWeight: 800, color: BRAND.teal, fontSize: compact ? 13 : 17 }}>{money(product.cartonPrice)}</span>
              )
            )}
          </div>
        )}
        {canPrice && fields.offerDetails && (Number(product.offerQuantity) > 0 || Number(product.bonusQuantity) > 0) && (
          <div style={{ fontSize: compact ? 9 : 11, color: BRAND.amber, fontWeight: 600 }}>
            {Number(product.offerQuantity) > 0 && `عرض: ${product.offerQuantity}`}
            {Number(product.offerQuantity) > 0 && Number(product.bonusQuantity) > 0 && ' · '}
            {Number(product.bonusQuantity) > 0 && `بونص: ${product.bonusQuantity}`}
          </div>
        )}
      </div>
    </div>
  );
}

export const PresentationPage = forwardRef<HTMLDivElement, Props>(function PresentationPage(
  { products, pageIndex, pageCount, options, company, meta, showPrices, defaultImageUrl, pdfSize },
  ref,
) {
  const { cols } = gridShape(options.perPage);
  const compact = options.perPage >= 9;
  const height = Math.round(PAGE_WIDTH * PAGE_RATIO[pdfSize]);
  const showHeader = options.chrome.logo || options.chrome.companyInfo || Boolean(meta.title);
  const showFooter =
    (options.chrome.contact && (company.phone || company.whatsapp || company.email || company.website || company.address)) ||
    options.chrome.pageNumbers ||
    (options.chrome.notes && Boolean(meta.notes));
  const contactBits = [company.phone, company.whatsapp && `واتساب ${company.whatsapp}`, company.email, company.website, company.address]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <div
      ref={ref}
      dir="rtl"
      data-pres-page=""
      style={{
        width: PAGE_WIDTH,
        height,
        background: BRAND.white,
        color: BRAND.ink,
        fontFamily: 'Tajawal, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        padding: 28,
        boxSizing: 'border-box',
      }}
    >
      {showHeader && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            paddingBottom: 12,
            marginBottom: 14,
            borderBottom: options.style === 'minimal' ? `1px solid ${BRAND.line}` : `2px solid ${BRAND.teal}`,
          }}
        >
          {options.chrome.logo && company.logo && (
            <img src={company.logo} alt="" style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'cover' }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {options.chrome.companyInfo && (
              <div style={{ fontWeight: 800, fontSize: 18, color: BRAND.teal }}>{company.name}</div>
            )}
            {options.chrome.companyInfo && company.tagline && (
              <div style={{ fontSize: 11, color: BRAND.muted }}>{company.tagline}</div>
            )}
          </div>
          <div style={{ textAlign: 'left' }}>
            {meta.title && <div style={{ fontWeight: 700, fontSize: 15 }}>{meta.title}</div>}
            {meta.client && <div style={{ fontSize: 12, color: BRAND.muted }}>{meta.client}</div>}
            {options.chrome.date && meta.date && <div style={{ fontSize: 11, color: BRAND.muted }}>{meta.date}</div>}
          </div>
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          // Fix the grid to the number of rows a FULL page holds, so every card
          // is the same (full-page) size regardless of how many products are on
          // this page. Without this (gridAutoRows: 1fr) an under-filled page
          // stretched its few rows to fill the whole sheet — giant cards with
          // empty middles. Now a partial page just leaves its trailing rows empty.
          gridTemplateRows: `repeat(${Math.max(1, Math.ceil(options.perPage / cols))}, 1fr)`,
          gap: compact ? 8 : 12,
          minHeight: 0,
        }}
      >
        {products.map((p) => (
          <ProductCell
            key={p.id}
            product={p}
            options={options}
            showPrices={showPrices}
            defaultImageUrl={defaultImageUrl}
            compact={compact}
          />
        ))}
      </div>

      {showFooter && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 8,
            borderTop: `1px solid ${BRAND.line}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            fontSize: 10,
            color: BRAND.muted,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {options.chrome.contact && contactBits}
            {options.chrome.notes && meta.notes && (
              <div style={{ marginTop: 2, color: BRAND.ink }}>{meta.notes}</div>
            )}
          </div>
          {options.chrome.pageNumbers && (
            <div style={{ whiteSpace: 'nowrap' }}>
              صفحة {pageIndex + 1} من {pageCount}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
