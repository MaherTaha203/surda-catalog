/**
 * Presentation Builder — live preview (zoom + page navigation).
 *
 * Renders the current page with the SAME PresentationPage used for generation,
 * scaled by the zoom level, so the preview reads like the finished PDF is open.
 */
import { ChevronLeft, ChevronRight, Minus, Plus, FileText } from 'lucide-react';
import type { Product } from '@/types/product';
import type { CompanyProfile } from '@/hooks/useCompanyProfile';
import { PresentationPage, PAGE_WIDTH, PAGE_RATIO, type PageMeta } from './PresentationPage';
import type { PdfSize, PresentationOptions } from './types';

const ZOOMS = [25, 50, 75, 100, 150, 200];

interface Props {
  pages: Product[][];
  pageIndex: number;
  setPageIndex: (i: number) => void;
  zoom: number;
  setZoom: (z: number) => void;
  options: PresentationOptions;
  company: CompanyProfile;
  meta: PageMeta;
  showPrices: boolean;
  defaultImageUrl: string;
  pdfSize: PdfSize;
}

export function PreviewPane({
  pages,
  pageIndex,
  setPageIndex,
  zoom,
  setZoom,
  options,
  company,
  meta,
  showPrices,
  defaultImageUrl,
  pdfSize,
}: Props) {
  const pageCount = Math.max(1, pages.length);
  const safeIndex = Math.min(pageIndex, pageCount - 1);
  const scale = zoom / 100;
  const scaledW = PAGE_WIDTH * scale;
  const scaledH = PAGE_WIDTH * PAGE_RATIO[pdfSize] * scale;
  const current = pages[safeIndex] ?? [];

  const stepZoom = (dir: 1 | -1) => {
    const idx = ZOOMS.indexOf(zoom);
    const next = idx === -1 ? 100 : Math.min(ZOOMS.length - 1, Math.max(0, idx + dir));
    setZoom(ZOOMS[next]);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-muted/40 rounded-2xl border border-border overflow-hidden">
      {/* Scrollable page stage */}
      <div className="flex-1 min-h-0 overflow-auto p-4 flex items-start justify-center">
        {pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-full text-muted-foreground gap-3 py-12">
            <FileText size={44} strokeWidth={1} aria-hidden />
            <p className="text-sm">أضف منتجات لبدء المعاينة</p>
          </div>
        ) : (
          <div style={{ width: scaledW, height: scaledH, flexShrink: 0 }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center', width: PAGE_WIDTH }}>
              <div className="shadow-lg">
                <PresentationPage
                  products={current}
                  pageIndex={safeIndex}
                  pageCount={pageCount}
                  options={options}
                  company={company}
                  meta={meta}
                  showPrices={showPrices}
                  defaultImageUrl={defaultImageUrl}
                  pdfSize={pdfSize}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="shrink-0 border-t border-border bg-background/70 backdrop-blur px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => stepZoom(-1)}
            aria-label="تصغير"
            className="p-1.5 rounded-lg hover:bg-muted text-foreground disabled:opacity-40"
            disabled={zoom <= ZOOMS[0]}
          >
            <Minus size={15} aria-hidden />
          </button>
          <div className="flex items-center gap-0.5">
            {ZOOMS.map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  zoom === z ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {z}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => stepZoom(1)}
            aria-label="تكبير"
            className="p-1.5 rounded-lg hover:bg-muted text-foreground disabled:opacity-40"
            disabled={zoom >= ZOOMS[ZOOMS.length - 1]}
          >
            <Plus size={15} aria-hidden />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPageIndex(Math.max(0, safeIndex - 1))}
            disabled={safeIndex <= 0}
            aria-label="الصفحة السابقة"
            className="p-1.5 rounded-lg hover:bg-muted text-foreground disabled:opacity-40"
          >
            <ChevronRight size={16} aria-hidden />
          </button>
          <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
            صفحة {safeIndex + 1} من {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPageIndex(Math.min(pageCount - 1, safeIndex + 1))}
            disabled={safeIndex >= pageCount - 1}
            aria-label="الصفحة التالية"
            className="p-1.5 rounded-lg hover:bg-muted text-foreground disabled:opacity-40"
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
