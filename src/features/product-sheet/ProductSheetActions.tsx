/**
 * Product Sheet actions — Print / Download PDF / Share for a single product.
 *
 * Renders the <ProductSheet/> off-screen at full resolution, then captures it
 * to a PDF (html2canvas + jsPDF, reusing the Presentation Builder's generation
 * pipeline) on demand. The generated PDF is memoized per product so the three
 * actions never re-capture the same sheet.
 *
 * Generation is fully client-side and offline-capable. The heavy libraries load
 * lazily inside generatePresentation, so nothing is pulled while browsing.
 */
import { useCallback, useRef, useState } from 'react';
import { Printer, Download, Share2, Loader2 } from 'lucide-react';
import { toast } from '@blinkdotnew/ui';
import type { Product } from '@/types/product';
import type { CompanyProfile } from '@/hooks/useCompanyProfile';
import { generatePresentation, downloadUrl, type GenerateResult } from '@/features/presentations/generate';
import { ProductSheet } from './ProductSheet';

interface Props {
  product: Product;
  company: CompanyProfile;
  showPrices: boolean;
  defaultImageUrl: string;
}

/** Resolve once every <img> under `root` has settled (loaded or errored). */
function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  return Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.addEventListener('load', () => res(), { once: true });
            img.addEventListener('error', () => res(), { once: true });
          }),
    ),
  ).then(() => undefined);
}

/** Sanitize a product name into a safe file base. */
function fileBase(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean || 'منتج';
}

export function ProductSheetActions({ product, company, showPrices, defaultImageUrl }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<null | 'print' | 'pdf' | 'share'>(null);
  // Memoized PDF for the CURRENT product — cleared implicitly by keying on id.
  const cache = useRef<{ id: string; result: GenerateResult } | null>(null);

  const dateLabel = new Intl.DateTimeFormat('ar', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  /** Capture the off-screen sheet into a PDF, memoized per product. */
  const buildPdf = useCallback(async (): Promise<GenerateResult> => {
    if (cache.current?.id === product.id) return cache.current.result;
    // Let the off-screen sheet paint, then wait for its images to decode so the
    // capture never races an undecoded logo/product image.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const node = sheetRef.current;
    if (!node) throw new Error('تعذّر تجهيز البطاقة');
    await waitForImages(node);
    const result = await generatePresentation([node], {
      type: 'pdf',
      pdfSize: 'A4',
      name: fileBase(product.name),
    });
    cache.current = { id: product.id, result };
    return result;
  }, [product.id, product.name]);

  const run = useCallback(
    async (action: 'print' | 'pdf' | 'share') => {
      if (busy) return;
      setBusy(action);
      try {
        const result = await buildPdf();
        if (!result.blob || !result.url) throw new Error('فشل إنشاء الملف');

        if (action === 'pdf') {
          downloadUrl(result.url, result.fileName);
        } else if (action === 'print') {
          // Open the PDF in a new tab — the built-in viewer offers Print.
          const win = window.open(result.url, '_blank', 'noopener');
          if (!win) toast.error('السماح بالنوافذ المنبثقة مطلوب للطباعة');
        } else {
          const file = new File([result.blob], result.fileName, { type: 'application/pdf' });
          const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
          if (nav.canShare && nav.canShare({ files: [file] })) {
            await nav.share({ files: [file], title: product.name });
          } else {
            // No Web Share for files → fall back to a download so the action
            // never dead-ends on desktop.
            downloadUrl(result.url, result.fileName);
            toast.success('المشاركة غير مدعومة — تم التنزيل بدلاً من ذلك');
          }
        }
      } catch (e) {
        // AbortError = the user dismissed the share sheet; not a failure.
        if ((e as Error)?.name !== 'AbortError') {
          toast.error((e as Error)?.message || 'تعذّر إنشاء البطاقة');
        }
      } finally {
        setBusy(null);
      }
    },
    [busy, buildPdf, product.name],
  );

  const canShare =
    typeof navigator !== 'undefined' &&
    'canShare' in navigator &&
    typeof (navigator as Navigator & { canShare?: unknown }).canShare === 'function';

  const btn =
    'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-wait';

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mt-6">
        <button
          type="button"
          onClick={() => run('print')}
          disabled={busy !== null}
          className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90`}
        >
          {busy === 'print' ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Printer size={16} aria-hidden />}
          طباعة
        </button>
        <button
          type="button"
          onClick={() => run('pdf')}
          disabled={busy !== null}
          className={`${btn} bg-muted text-foreground hover:bg-muted/70`}
        >
          {busy === 'pdf' ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />}
          تنزيل PDF
        </button>
        {canShare && (
          <button
            type="button"
            onClick={() => run('share')}
            disabled={busy !== null}
            className={`${btn} bg-muted text-foreground hover:bg-muted/70`}
          >
            {busy === 'share' ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Share2 size={16} aria-hidden />}
            مشاركة
          </button>
        )}
      </div>

      {/* Off-screen capture stage — rendered but never shown/interactive. */}
      <div style={{ position: 'fixed', left: -100000, top: 0, opacity: 0, pointerEvents: 'none' }} aria-hidden>
        <ProductSheet
          ref={sheetRef}
          product={product}
          company={company}
          showPrices={showPrices}
          defaultImageUrl={defaultImageUrl}
          dateLabel={dateLabel}
        />
      </div>
    </>
  );
}
