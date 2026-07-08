/**
 * Presentation Builder — the one workspace (brief §1–§7).
 *
 * Right control rail (products · info · options) + left hero live preview, a
 * progressive "إنشاء" split-button, silent save, template + history menus. The
 * heavy generation libraries load lazily inside generate.ts, so nothing here runs
 * while browsing the catalog. Admin/PIN-gated like the rest of the panel.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@blinkdotnew/ui';
import { ArrowRight, Presentation as PresentationIcon, Save, FileStack, PencilLine, Eye } from 'lucide-react';
import { isAdminUnlocked, isPinUnlocked } from '@/lib/storage';
import { useIsClient } from '@/hooks/useIsClient';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import { useCatalogSettings } from '@/hooks/useCatalogSettings';
import { useDisplayPrefs, effectiveShowPrices } from '@/lib/display-prefs';
import { fetchProducts, PRODUCTS_KEY } from '@/hooks/useProducts';
import type { Product } from '@/types/product';
import { CatalogPicker } from './CatalogPicker';
import { SelectedProductsPanel } from './SelectedProductsPanel';
import { OptionsPanel } from './OptionsPanel';
import { PreviewPane } from './PreviewPane';
import { GenerateMenu } from './GenerateMenu';
import { TemplateMenu } from './TemplateMenu';
import { HistoryDrawer } from './HistoryDrawer';
import { ResultSheet } from './ResultSheet';
import { PresentationPage, type PageMeta } from './PresentationPage';
import { generatePresentation, type GenerateResult } from './generate';
import {
  createPresentation,
  savePresentation,
  duplicatePresentation,
  useCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
} from './store';
import type { PdfSize, PerPage, Presentation, PresentationOptions, PresentationTemplate } from './types';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

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

export function PresentationBuilderPage() {
  const navigate = useNavigate();
  const isClient = useIsClient();
  const unlocked = isClient && isPinUnlocked() && isAdminUnlocked();

  useEffect(() => {
    if (isClient && !unlocked) navigate({ to: '/', replace: true });
  }, [unlocked, navigate, isClient]);

  const company = useCompanyProfile();
  const settings = useCatalogSettings();
  const { prefs } = useDisplayPrefs();
  const showPrices = effectiveShowPrices(settings, prefs);
  const customTemplates = useCustomTemplates();

  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: PRODUCTS_KEY,
    queryFn: fetchProducts,
    enabled: unlocked && isClient,
    staleTime: 30_000,
  });
  const productMap = useMemo(() => new Map(allProducts.map((p) => [p.id, p])), [allProducts]);

  const [pres, setPres] = useState<Presentation>(() => createPresentation());
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(75);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [genJob, setGenJob] = useState<{ pres: Presentation; type: 'pdf' | 'images' } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const resolved = useMemo(
    () => pres.productIds.map((id) => productMap.get(id)).filter((p): p is Product => Boolean(p)),
    [pres.productIds, productMap],
  );
  const pages = useMemo(() => chunk(resolved, pres.options.perPage), [resolved, pres.options.perPage]);

  const meta: PageMeta = useMemo(
    () => ({
      title: pres.name,
      client: pres.client,
      date: pres.date ? new Date(pres.date).toLocaleDateString('ar', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '',
      notes: pres.notes,
    }),
    [pres.name, pres.client, pres.date, pres.notes],
  );

  // ── Mutators ─────────────────────────────────────────────────────────────────
  const patch = useCallback((p: Partial<Presentation>) => setPres((cur) => ({ ...cur, ...p })), []);
  const patchOptions = useCallback(
    (o: Partial<PresentationOptions>) => setPres((cur) => ({ ...cur, options: { ...cur.options, ...o } })),
    [],
  );

  const toggleProduct = useCallback((id: string) => {
    setPres((cur) => ({
      ...cur,
      productIds: cur.productIds.includes(id) ? cur.productIds.filter((x) => x !== id) : [...cur.productIds, id],
    }));
  }, []);

  const applyTemplate = useCallback((tpl: PresentationTemplate) => {
    setPres((cur) => ({
      ...cur,
      templateId: tpl.id,
      options: { ...tpl.options, fields: { ...tpl.options.fields }, chrome: { ...tpl.options.chrome } },
      output: { ...cur.output, pdfSize: tpl.output.pdfSize },
    }));
  }, []);

  const save = useCallback(() => {
    const saved = savePresentation(pres);
    setPres(saved);
    toast.success('تم الحفظ');
  }, [pres]);

  // ── Generation (offscreen capture) ───────────────────────────────────────────
  const runGenerate = useCallback((target: Presentation, type: 'pdf' | 'images') => {
    const count = target.productIds.filter((id) => productMap.has(id)).length;
    if (count === 0) {
      toast.error('أضف منتجات أولاً');
      return;
    }
    setBusy(true);
    setGenJob({ pres: { ...target, output: { ...target.output, type } }, type });
  }, [productMap]);

  useEffect(() => {
    if (!genJob) return;
    let cancelled = false;
    (async () => {
      try {
        // Let the offscreen stage paint, then wait for its images to decode.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const stage = stageRef.current;
        if (!stage) throw new Error('stage missing');
        await waitForImages(stage);
        const nodes = Array.from(stage.querySelectorAll<HTMLElement>('[data-pres-page]'));
        const res = await generatePresentation(nodes, {
          type: genJob.type,
          pdfSize: genJob.pres.output.pdfSize,
          name: genJob.pres.name,
        });
        if (cancelled) return;
        savePresentation(genJob.pres); // generated ⇒ worth keeping in history
        setResult(res);
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message || 'فشل التوليد');
      } finally {
        if (!cancelled) {
          setBusy(false);
          setGenJob(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [genJob]);

  // ── History actions ──────────────────────────────────────────────────────────
  const openFromHistory = useCallback((p: Presentation) => {
    setPres({ ...p, options: { ...p.options, fields: { ...p.options.fields }, chrome: { ...p.options.chrome } } });
    setPageIndex(0);
    setHistoryOpen(false);
    setMobileTab('edit');
  }, []);

  const duplicateFromHistory = useCallback((id: string) => {
    const dup = duplicatePresentation(id);
    if (dup) {
      openFromHistory(dup);
      toast.success('تم إنشاء نسخة');
    }
  }, [openFromHistory]);

  const regenerateFromHistory = useCallback((p: Presentation) => {
    // Same products + settings, today's date, no editing (brief §6 Regenerate).
    const dated: Presentation = { ...p, date: new Date().toISOString().slice(0, 10) };
    setHistoryOpen(false);
    runGenerate(dated, dated.output.type);
  }, [runGenerate]);

  const genPages = genJob ? chunk(genJob.pres.productIds.map((id) => productMap.get(id)).filter((x): x is Product => Boolean(x)), genJob.pres.options.perPage) : [];
  const genMeta: PageMeta = genJob
    ? {
        title: genJob.pres.name,
        client: genJob.pres.client,
        date: genJob.pres.date ? new Date(genJob.pres.date).toLocaleDateString('ar', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '',
        notes: genJob.pres.notes,
      }
    : meta;

  if (!unlocked) return null;

  return (
    <div className="min-h-dvh bg-background flex flex-col" dir="rtl">
      {/* Toolbar */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate({ to: '/admin' })}
            aria-label="لوحة التحكم"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <ArrowRight size={18} aria-hidden />
          </button>
          <PresentationIcon size={18} className="text-primary shrink-0 hidden sm:block" aria-hidden />
          <input
            value={pres.name}
            onChange={(e) => patch({ name: e.target.value })}
            aria-label="اسم العرض"
            className="min-w-0 flex-1 max-w-[16rem] px-2 py-1.5 rounded-lg bg-transparent hover:bg-muted focus:bg-muted text-sm font-bold text-foreground focus:outline-none"
          />
          <div className="flex items-center gap-1.5 ms-auto shrink-0">
            <TemplateMenu
              currentTemplateId={pres.templateId}
              customTemplates={customTemplates}
              onSelect={applyTemplate}
              onSaveTemplate={(name) => {
                saveCustomTemplate(name, pres.options, pres.output);
                toast.success('تم حفظ القالب');
              }}
              onDeleteTemplate={deleteCustomTemplate}
            />
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              aria-label="العروض السابقة"
              className="p-2 rounded-lg bg-muted text-foreground hover:bg-muted/70 transition-colors"
            >
              <FileStack size={16} aria-hidden />
            </button>
            <button
              type="button"
              onClick={save}
              aria-label="حفظ"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/70 transition-colors"
            >
              <Save size={16} aria-hidden />
              <span className="hidden sm:inline">حفظ</span>
            </button>
            <GenerateMenu
              pdfSize={pres.output.pdfSize}
              perPage={pres.options.perPage}
              onPickPdfSize={(s: PdfSize) => setPres((c) => ({ ...c, output: { ...c.output, pdfSize: s } }))}
              onPickPerPage={(n: PerPage) => patchOptions({ perPage: n })}
              onGenerate={(type) => runGenerate(pres, type)}
              busy={busy}
            />
          </div>
        </div>

        {/* Mobile tab switch */}
        <div className="lg:hidden max-w-6xl mx-auto px-3 pb-2">
          <div className="flex gap-1 p-1 rounded-xl bg-muted">
            <button
              type="button"
              onClick={() => setMobileTab('edit')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${mobileTab === 'edit' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              <PencilLine size={15} aria-hidden /> تحرير
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('preview')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${mobileTab === 'preview' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              <Eye size={15} aria-hidden /> معاينة
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 w-full max-w-6xl mx-auto px-3 sm:px-4 py-3 lg:grid lg:grid-cols-[340px_1fr] lg:gap-3">
        {/* Control rail (right) */}
        <aside className={`${mobileTab === 'edit' ? 'block' : 'hidden'} lg:block space-y-3 lg:overflow-y-auto lg:max-h-[calc(100dvh-88px)] pb-4`}>
          <section className="rounded-2xl border border-border bg-card p-3">
            <SelectedProductsPanel
              products={resolved}
              showPrice={showPrices}
              onReorder={(ids) => patch({ productIds: ids })}
              onRemove={(id) => toggleProduct(id)}
              onAddClick={() => setPickerOpen(true)}
            />
          </section>

          <section className="rounded-2xl border border-border bg-card p-3 space-y-2.5">
            <h3 className="text-sm font-bold text-foreground">معلومات العرض</h3>
            <label className="block">
              <span className="text-xs text-muted-foreground">العميل</span>
              <input
                value={pres.client}
                onChange={(e) => patch({ client: e.target.value })}
                className="mt-1 w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs text-muted-foreground">التاريخ</span>
                <input
                  type="date"
                  value={pres.date}
                  onChange={(e) => patch({ date: e.target.value })}
                  className="mt-1 w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
                />
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">تاريخ الانتهاء</span>
                <input
                  type="date"
                  value={pres.expiry}
                  onChange={(e) => patch({ expiry: e.target.value })}
                  className="mt-1 w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-muted-foreground">ملاحظات</span>
              <textarea
                value={pres.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                rows={2}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground resize-none"
              />
            </label>
          </section>

          <section className="rounded-2xl border border-border bg-card p-3">
            <h3 className="text-sm font-bold text-foreground mb-2">خيارات العرض</h3>
            <OptionsPanel options={pres.options} onChange={patchOptions} showPricesGlobal={settings.showPrices} />
          </section>
        </aside>

        {/* Preview (left, hero) */}
        <section className={`${mobileTab === 'preview' ? 'block' : 'hidden'} lg:block h-[65vh] lg:h-[calc(100dvh-88px)]`}>
          <PreviewPane
            pages={pages}
            pageIndex={pageIndex}
            setPageIndex={setPageIndex}
            zoom={zoom}
            setZoom={setZoom}
            options={pres.options}
            company={company}
            meta={meta}
            showPrices={showPrices}
            defaultImageUrl={settings.defaultProductImageUrl}
            pdfSize={pres.output.pdfSize}
          />
        </section>
      </main>

      {/* Offscreen generation stage — renders ALL pages at full resolution only while generating */}
      {genJob && (
        <div ref={stageRef} style={{ position: 'fixed', left: -100000, top: 0, opacity: 0, pointerEvents: 'none' }} aria-hidden>
          {genPages.map((pg, i) => (
            <PresentationPage
              key={i}
              products={pg}
              pageIndex={i}
              pageCount={genPages.length}
              options={genJob.pres.options}
              company={company}
              meta={genMeta}
              showPrices={showPrices}
              defaultImageUrl={settings.defaultProductImageUrl}
              pdfSize={genJob.pres.output.pdfSize}
            />
          ))}
        </div>
      )}

      {pickerOpen && (
        <CatalogPicker
          presentationName={pres.name}
          selectedIds={pres.productIds}
          onToggle={toggleProduct}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onOpen={openFromHistory}
        onDuplicate={duplicateFromHistory}
        onRegenerate={regenerateFromHistory}
      />

      {result && <ResultSheet result={result} onClose={() => setResult(null)} />}
    </div>
  );
}
