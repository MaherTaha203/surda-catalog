/**
 * Presentation Builder — result sheet (lightweight, brief §3/§4).
 *
 * Shown after generation: download / share / print for a PDF, or a small gallery
 * with download-all for images. No heavy chrome — one confirmation of success
 * and the actions the rep needs.
 */
import { CheckCircle2, Download, Share2, Printer, X } from 'lucide-react';
import { toast } from '@blinkdotnew/ui';
import { motion } from 'framer-motion';
import { downloadUrl, type GenerateResult } from './generate';

interface Props {
  result: GenerateResult;
  onClose: () => void;
}

export function ResultSheet({ result, onClose }: Props) {
  const summary =
    result.type === 'pdf'
      ? 'ملف PDF جاهز'
      : `${result.images?.length ?? 0} صور جاهزة`;

  const handleShare = async () => {
    try {
      const files: File[] = [];
      if (result.type === 'pdf' && result.blob) {
        files.push(new File([result.blob], result.fileName, { type: 'application/pdf' }));
      } else if (result.images) {
        for (const im of result.images) {
          const blob = await (await fetch(im.url)).blob();
          files.push(new File([blob], im.name, { type: 'image/png' }));
        }
      }
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (files.length && nav.canShare && nav.canShare({ files })) {
        await nav.share({ files, title: result.fileName });
      } else {
        toast.error('المشاركة غير مدعومة على هذا الجهاز — استخدم التنزيل');
      }
    } catch {
      /* user cancelled share — ignore */
    }
  };

  const handleDownload = () => {
    if (result.type === 'pdf' && result.url) {
      downloadUrl(result.url, result.fileName);
    } else if (result.images) {
      // Stagger downloads so the browser doesn't drop concurrent ones.
      result.images.forEach((im, i) => setTimeout(() => downloadUrl(im.url, im.name), i * 250));
    }
  };

  const handlePrint = () => {
    if (result.url) window.open(result.url, '_blank', 'noopener');
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-2xl border border-border p-5 shadow-xl"
      >
        <button type="button" onClick={onClose} aria-label="إغلاق" className="absolute top-3 left-3 p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
          <X size={18} aria-hidden />
        </button>
        <div className="flex flex-col items-center text-center gap-1 mb-4">
          <CheckCircle2 size={40} className="text-green-600" aria-hidden />
          <h2 className="text-base font-bold text-foreground">تم الإنشاء</h2>
          <p className="text-xs text-muted-foreground">{result.fileName} · {summary}</p>
        </div>

        {result.type === 'images' && result.images && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none mb-4 pb-1">
            {result.images.map((im) => (
              <img key={im.name} src={im.url} alt={im.name} className="h-24 rounded-lg border border-border shrink-0" />
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            <Download size={16} aria-hidden /> تنزيل
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/70 transition-colors"
          >
            <Share2 size={16} aria-hidden /> مشاركة
          </button>
          {result.type === 'pdf' && (
            <button
              type="button"
              onClick={handlePrint}
              className="col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/70 transition-colors"
            >
              <Printer size={16} aria-hidden /> طباعة / فتح
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
