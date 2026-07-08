/**
 * Presentation Builder — progressive "إنشاء ▼" (brief §3).
 *
 * Generate → choose PDF or Images → only THEN reveal the relevant sub-options
 * (PDF: A4/A5/Letter · Images: 4/6/9/12 per page) → generate. Nothing extra is
 * shown until it's needed.
 */
import { useState } from 'react';
import { Sparkles, FileText, Images as ImagesIcon, ChevronLeft, Loader2 } from 'lucide-react';
import { PDF_SIZES, PER_PAGE_OPTIONS, type PdfSize, type PerPage } from './types';

interface Props {
  pdfSize: PdfSize;
  perPage: PerPage;
  onPickPdfSize: (s: PdfSize) => void;
  onPickPerPage: (n: PerPage) => void;
  onGenerate: (type: 'pdf' | 'images') => void;
  busy: boolean;
}

export function GenerateMenu({ pdfSize, perPage, onPickPdfSize, onPickPerPage, onGenerate, busy }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'root' | 'pdf' | 'images'>('root');

  const close = () => {
    setOpen(false);
    setStep('root');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} aria-hidden />}
        إنشاء
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} aria-hidden />
          <div className="absolute z-50 mt-1 end-0 w-56 rounded-xl border border-border bg-background shadow-xl p-1.5" dir="rtl">
            {step === 'root' && (
              <>
                <button
                  type="button"
                  onClick={() => setStep('pdf')}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg hover:bg-muted text-sm text-foreground"
                >
                  <span className="flex items-center gap-2"><FileText size={16} aria-hidden /> PDF</span>
                  <ChevronLeft size={15} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setStep('images')}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg hover:bg-muted text-sm text-foreground"
                >
                  <span className="flex items-center gap-2"><ImagesIcon size={16} aria-hidden /> صور</span>
                  <ChevronLeft size={15} aria-hidden />
                </button>
              </>
            )}

            {step === 'pdf' && (
              <div className="p-1.5 space-y-2">
                <p className="text-xs font-medium text-muted-foreground px-1">حجم الورق</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {PDF_SIZES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onPickPdfSize(s)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        pdfSize === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/70'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onGenerate('pdf');
                  }}
                  className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
                >
                  توليد PDF
                </button>
              </div>
            )}

            {step === 'images' && (
              <div className="p-1.5 space-y-2">
                <p className="text-xs font-medium text-muted-foreground px-1">عدد المنتجات في الصفحة</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {PER_PAGE_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onPickPerPage(n)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        perPage === n ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/70'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onGenerate('images');
                  }}
                  className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
                >
                  توليد الصور
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
