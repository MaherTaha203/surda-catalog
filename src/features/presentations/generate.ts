/**
 * Presentation Builder — output generation (PDF / images).
 *
 * The heavy libraries (html2canvas + jsPDF) are imported DYNAMICALLY here, so
 * they load only when the rep actually generates — never while browsing the
 * catalog or even while editing a presentation. Generation is fully client-side
 * (offline-capable) and captures the exact preview pages, so output == preview.
 */
import type { PdfSize } from './types';

export interface GenerateResult {
  type: 'pdf' | 'images';
  fileName: string;
  /** PDF output. */
  blob?: Blob;
  url?: string;
  /** Image output — one entry per page. */
  images?: { name: string; url: string }[];
}

/** Paper size in millimetres (portrait). */
const PDF_MM: Record<PdfSize, [number, number]> = {
  A4: [210, 297],
  A5: [148, 210],
  Letter: [215.9, 279.4],
};

function sanitize(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean || 'عرض';
}

async function renderPage(el: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas');
  return html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    // Capture the element at its intrinsic size even when rendered offscreen.
    width: el.offsetWidth,
    height: el.offsetHeight,
    windowWidth: el.offsetWidth,
    windowHeight: el.offsetHeight,
  });
}

/**
 * Capture each page element and produce the requested output. `pages` are the
 * live PresentationPage DOM nodes (rendered offscreen at full resolution).
 */
export async function generatePresentation(
  pages: HTMLElement[],
  opts: { type: 'pdf' | 'images'; pdfSize: PdfSize; name: string },
): Promise<GenerateResult> {
  if (pages.length === 0) throw new Error('لا توجد صفحات للتوليد');
  const base = sanitize(opts.name);

  if (opts.type === 'images') {
    const images: { name: string; url: string }[] = [];
    for (let i = 0; i < pages.length; i++) {
      const canvas = await renderPage(pages[i]);
      images.push({ name: `${base}-${i + 1}.png`, url: canvas.toDataURL('image/png') });
    }
    return { type: 'images', fileName: base, images };
  }

  // PDF: one captured page per document page, scaled to fill the sheet.
  const { default: jsPDF } = await import('jspdf');
  const [mmW, mmH] = PDF_MM[opts.pdfSize];
  const format = opts.pdfSize === 'Letter' ? 'letter' : opts.pdfSize.toLowerCase();
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format });
  for (let i = 0; i < pages.length; i++) {
    const canvas = await renderPage(pages[i]);
    const img = canvas.toDataURL('image/jpeg', 0.92);
    if (i > 0) pdf.addPage(format, 'portrait');
    pdf.addImage(img, 'JPEG', 0, 0, mmW, mmH, undefined, 'FAST');
  }
  const blob = pdf.output('blob');
  return { type: 'pdf', fileName: `${base}.pdf`, blob, url: URL.createObjectURL(blob) };
}

/** Trigger a browser download for a data/object URL. */
export function downloadUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
