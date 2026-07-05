/**
 * Bulk image import — admin page "استيراد الصور".
 *
 * Phase 1: upload many product images at once (100–400 in a session). Each is
 * compressed client-side and uploaded once; its stored URL is reused everywhere.
 * Phase 2, two modes over the SAME uploaded images (no re-uploading):
 *   • جدول (table): fill every image's fields in a list, then "إنشاء جميع
 *     المنتجات" creates them all in one transaction (or save each row on its own).
 *   • إدخال سريع (quick entry): images are auto-created as hidden drafts, then
 *     edited one at a time with keyboard navigation and autosave, with a live
 *     progress bar. "نشر جميع المنتجات" publishes the completed drafts.
 * PIN-gated like the rest of the admin panel.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { toast } from '@blinkdotnew/ui';
import { ArrowRight, Upload, Images, Rows3, Zap, Loader2, Send, Rocket } from 'lucide-react';
import { isAdminUnlocked, isPinUnlocked } from '@/lib/storage';
import { useIsClient } from '@/hooks/useIsClient';
import { useQueryClient } from '@tanstack/react-query';
import { PRODUCTS_KEY } from '@/hooks/useProducts';
import {
  bulkCreateProducts,
  createProduct,
  updateProduct,
  publishProducts,
  uploadProductImage,
} from '@/api/products';
import { compressProductImage } from '@/lib/image-compression';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { suggestNameFromFilename, runPool } from './filename';
import { DEFAULT_CATEGORY, isRowComplete, rowToPayload, type ImportRow } from './types';
import { ImportTableRow } from './ImportTableRow';
import { QuickEntryEditor } from './QuickEntryEditor';

const UPLOAD_CONCURRENCY = 4;

function newRow(file: File): ImportRow {
  return {
    localId: crypto.randomUUID(),
    file,
    fileName: file.name,
    previewUrl: URL.createObjectURL(file),
    imageUrl: '',
    upload: 'pending',
    name: suggestNameFromFilename(file.name),
    category: DEFAULT_CATEGORY,
    size: '',
    cartonPrice: '',
    offerPrice: '',
    offerQuantity: '',
    bonusQuantity: '',
    description: '',
    createdId: null,
    published: false,
    savedAt: null,
  };
}

export function ImageImportPage() {
  const navigate = useNavigate();
  const isClient = useIsClient();
  const queryClient = useQueryClient();
  const unlocked = isClient && isPinUnlocked() && isAdminUnlocked();

  useEffect(() => {
    if (isClient && !unlocked) navigate({ to: '/', replace: true });
  }, [unlocked, navigate, isClient]);

  const [rows, setRows] = useState<ImportRow[]>([]);
  const [mode, setMode] = useState<'table' | 'quick'>('table');
  const [quickIndex, setQuickIndex] = useState(0);
  const [busy, setBusy] = useState(false); // create-all / publish / ensure-drafts
  const [savingId, setSavingId] = useState<string | null>(null);
  const [quickSaving, setQuickSaving] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const quickIndexRef = useRef(quickIndex);
  quickIndexRef.current = quickIndex;

  // Revoke all object URLs on unmount (avoid leaking hundreds of blobs).
  useEffect(
    () => () => {
      rowsRef.current.forEach((r) => r.previewUrl && URL.revokeObjectURL(r.previewUrl));
    },
    [],
  );

  const refreshCatalog = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
  }, [queryClient]);

  const updateRow = useCallback((localId: string, patch: Partial<ImportRow>) => {
    setRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));
  }, []);

  // ── Phase 1: upload ─────────────────────────────────────────────────────────
  const onFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (!files.length) {
      toast.error('لم يتم اختيار صور صالحة');
      return;
    }
    const fresh = files.map(newRow);
    setRows((prev) => [...prev, ...fresh]);
    await runPool(fresh, UPLOAD_CONCURRENCY, async (row) => {
      updateRow(row.localId, { upload: 'uploading' });
      try {
        const compressed = row.file ? await compressProductImage(row.file) : null;
        if (!compressed) throw new Error('الملف غير متاح');
        const url = await uploadProductImage(compressed);
        updateRow(row.localId, { imageUrl: url, upload: 'done', file: undefined });
      } catch (e) {
        updateRow(row.localId, { upload: 'error', uploadError: (e as Error).message });
      }
    });
  }, [updateRow]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) void onFiles(e.dataTransfer.files);
  };

  const removeRow = useCallback((localId: string) => {
    setRows((prev) => {
      const target = prev.find((r) => r.localId === localId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((r) => r.localId !== localId);
    });
  }, []);

  // ── Table mode: per-row save + create all ────────────────────────────────────
  const saveRow = useCallback(
    async (localId: string) => {
      const row = rowsRef.current.find((r) => r.localId === localId);
      if (!row || row.upload !== 'done' || !row.name.trim()) return;
      setSavingId(localId);
      try {
        if (row.createdId) {
          await updateProduct(row.createdId, rowToPayload(row, { isHidden: 0 }));
          updateRow(localId, { published: true, savedAt: Date.now() });
        } else {
          const created = await createProduct(rowToPayload(row, { isHidden: 0 }));
          updateRow(localId, { createdId: created.id, published: true, savedAt: Date.now() });
        }
        refreshCatalog();
        toast.success('تم حفظ المنتج');
      } catch (e) {
        toast.error((e as Error).message || 'فشل الحفظ');
      } finally {
        setSavingId(null);
      }
    },
    [updateRow, refreshCatalog],
  );

  const createAll = useCallback(async () => {
    const ready = rowsRef.current.filter((r) => !r.createdId && r.upload === 'done' && r.name.trim());
    if (!ready.length) {
      toast.error('لا توجد منتجات جاهزة (تحتاج صورة مرفوعة واسماً)');
      return;
    }
    setBusy(true);
    try {
      const created = await bulkCreateProducts(ready.map((r) => rowToPayload(r, { isHidden: 0 })));
      setRows((prev) => {
        const byLocal = new Map<string, string>();
        ready.forEach((r, i) => created[i] && byLocal.set(r.localId, created[i].id));
        return prev.map((r) =>
          byLocal.has(r.localId) ? { ...r, createdId: byLocal.get(r.localId)!, published: true, savedAt: Date.now() } : r,
        );
      });
      refreshCatalog();
      toast.success(`تم إنشاء ${created.length} منتج`);
    } catch (e) {
      toast.error((e as Error).message || 'فشل إنشاء المنتجات');
    } finally {
      setBusy(false);
    }
  }, [refreshCatalog]);

  // ── Quick mode: ensure drafts, autosave-on-navigate, publish all ─────────────
  const ensureDrafts = useCallback(async () => {
    const need = rowsRef.current.filter((r) => !r.createdId && r.upload === 'done');
    if (!need.length) return;
    setBusy(true);
    try {
      const created = await bulkCreateProducts(need.map((r) => rowToPayload(r, { isHidden: 1 })));
      setRows((prev) => {
        const byLocal = new Map<string, string>();
        need.forEach((r, i) => created[i] && byLocal.set(r.localId, created[i].id));
        return prev.map((r) =>
          byLocal.has(r.localId) ? { ...r, createdId: byLocal.get(r.localId)!, savedAt: Date.now() } : r,
        );
      });
      refreshCatalog();
    } catch (e) {
      toast.error((e as Error).message || 'فشل إنشاء المسودات');
    } finally {
      setBusy(false);
    }
  }, [refreshCatalog]);

  const enterQuickMode = useCallback(async () => {
    setMode('quick');
    setQuickIndex(0);
    await ensureDrafts();
  }, [ensureDrafts]);

  const saveQuickRow = useCallback(
    async (row: ImportRow) => {
      if (!row.createdId) return;
      setQuickSaving(true);
      try {
        await updateProduct(row.createdId, rowToPayload(row, { isHidden: row.published ? 0 : 1 }));
        updateRow(row.localId, { savedAt: Date.now() });
      } catch (e) {
        toast.error((e as Error).message || 'فشل الحفظ التلقائي');
      } finally {
        setQuickSaving(false);
      }
    },
    [updateRow],
  );

  const draftRows = useMemo(() => rows.filter((r) => r.createdId != null), [rows]);

  const onNavigate = useCallback(
    (delta: number) => {
      const list = rowsRef.current.filter((r) => r.createdId != null);
      if (!list.length) return;
      const cur = list[quickIndexRef.current];
      if (cur) void saveQuickRow(cur);
      setQuickIndex((i) => Math.max(0, Math.min(list.length - 1, i + delta)));
    },
    [saveQuickRow],
  );

  const jumpTo = useCallback(
    (targetIndex: number) => {
      const list = rowsRef.current.filter((r) => r.createdId != null);
      const cur = list[quickIndexRef.current];
      if (cur) void saveQuickRow(cur);
      setQuickIndex(Math.max(0, Math.min(list.length - 1, targetIndex)));
    },
    [saveQuickRow],
  );

  const publishAll = useCallback(async () => {
    setConfirmPublish(false);
    const completed = rowsRef.current.filter((r) => r.createdId && isRowComplete(r) && !r.published);
    if (!completed.length) {
      toast.error('لا توجد منتجات مكتملة للنشر');
      return;
    }
    setBusy(true);
    try {
      // Persist the currently focused row first so its latest edits publish too.
      const list = rowsRef.current.filter((r) => r.createdId != null);
      const cur = list[quickIndexRef.current];
      if (cur) await saveQuickRow(cur);
      const ids = completed.map((r) => r.createdId as string);
      const changed = await publishProducts(ids, 0);
      const publishedSet = new Set(completed.map((r) => r.localId));
      setRows((prev) => prev.map((r) => (publishedSet.has(r.localId) ? { ...r, published: true } : r)));
      refreshCatalog();
      toast.success(`تم نشر ${changed} منتج`);
    } catch (e) {
      toast.error((e as Error).message || 'فشل النشر');
    } finally {
      setBusy(false);
    }
  }, [saveQuickRow, refreshCatalog]);

  // ── Derived counts ────────────────────────────────────────────────────────────
  const uploaded = rows.filter((r) => r.upload === 'done').length;
  const uploading = rows.some((r) => r.upload === 'uploading');
  const pendingCreate = rows.filter((r) => !r.createdId && r.upload === 'done' && r.name.trim()).length;
  const quickTotal = draftRows.length;
  const quickCompleted = draftRows.filter(isRowComplete).length;
  const quickRemaining = quickTotal - quickCompleted;
  const unpublishedCompleted = draftRows.filter((r) => isRowComplete(r) && !r.published).length;
  const currentQuick = draftRows[Math.min(quickIndex, Math.max(0, draftRows.length - 1))];

  if (!unlocked) return null;

  return (
    <div className="min-h-dvh bg-background" dir="rtl">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <Link
              to="/admin"
              aria-label="لوحة التحكم"
              className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowRight size={18} aria-hidden />
              <span className="hidden sm:inline">لوحة التحكم</span>
            </Link>
            <h1 className="flex items-center gap-2 text-base sm:text-lg font-bold text-foreground whitespace-nowrap">
              <Images size={18} className="text-primary" aria-hidden />
              استيراد الصور
            </h1>
          </div>
          {rows.length > 0 && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {rows.length} صورة · تم الرفع {uploaded}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4 pb-28">
        {/* Phase 1: upload zone */}
        <section
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border bg-card'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void onFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Upload size={28} className="mx-auto text-muted-foreground mb-2" aria-hidden />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Upload size={16} aria-hidden /> رفع الصور
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            اختر صور المنتجات (يمكن رفع 100 أو 300 أو 400 صورة دفعة واحدة). يُقترح الاسم تلقائياً من اسم الملف.
          </p>
          {uploading && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-primary">
              <Loader2 size={13} className="animate-spin" aria-hidden /> جارٍ رفع الصور…
            </p>
          )}
        </section>

        {rows.length > 0 && (
          <>
            {/* Mode toggle */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted w-fit">
              <button
                type="button"
                onClick={() => setMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'table' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                <Rows3 size={15} aria-hidden /> وضع الجدول
              </button>
              <button
                type="button"
                onClick={() => void enterQuickMode()}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'quick' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                <Zap size={15} aria-hidden /> الإدخال السريع
              </button>
            </div>

            {mode === 'table' ? (
              <section className="space-y-2">
                <ul className="space-y-2">
                  {rows.map((row, i) => (
                    <ImportTableRow
                      key={row.localId}
                      row={row}
                      index={i}
                      onChange={updateRow}
                      onSave={saveRow}
                      onRemove={removeRow}
                      saving={savingId === row.localId}
                    />
                  ))}
                </ul>
              </section>
            ) : (
              <section className="space-y-3">
                {/* Progress */}
                <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-foreground">
                      {quickTotal ? Math.min(quickIndex + 1, quickTotal) : 0} / {quickTotal} منتج
                    </span>
                    <span className="text-xs text-muted-foreground">
                      مكتمل: <span className="text-green-600 font-medium">{quickCompleted}</span> · متبقي:{' '}
                      <span className="text-amber-600 font-medium">{quickRemaining}</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: quickTotal ? `${(quickCompleted / quickTotal) * 100}%` : '0%' }}
                    />
                  </div>
                </div>

                {busy && !currentQuick ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                    <Loader2 size={16} className="animate-spin" aria-hidden /> جارٍ تجهيز المسودات…
                  </div>
                ) : currentQuick ? (
                  <>
                    <QuickEntryEditor
                      row={currentQuick}
                      onChange={updateRow}
                      onNavigate={onNavigate}
                      saving={quickSaving}
                    />
                    {/* Thumbnail strip for jumping */}
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
                      {draftRows.map((r, i) => (
                        <button
                          key={r.localId}
                          type="button"
                          onClick={() => jumpTo(i)}
                          aria-label={`المنتج ${i + 1}`}
                          className={`relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                            i === quickIndex ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                        >
                          {r.previewUrl && <img src={r.previewUrl} alt="" className="w-full h-full object-cover" />}
                          {isRowComplete(r) && (
                            <span className="absolute inset-x-0 bottom-0 h-1 bg-green-500" aria-hidden />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-10">
                    ارفع الصور أولاً لبدء الإدخال السريع.
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {/* Sticky action bar */}
      {rows.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-background/90 backdrop-blur-md border-t border-border">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
            {mode === 'table' ? (
              <>
                <span className="text-xs text-muted-foreground">جاهز للإنشاء: {pendingCreate}</span>
                <button
                  type="button"
                  disabled={busy || uploading || pendingCreate === 0}
                  onClick={() => void createAll()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40 hover:bg-primary/90 transition-colors"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Rocket size={16} aria-hidden />}
                  إنشاء جميع المنتجات ({pendingCreate})
                </button>
              </>
            ) : (
              <>
                <span className="text-xs text-muted-foreground">جاهز للنشر: {unpublishedCompleted}</span>
                <button
                  type="button"
                  disabled={busy || uploading || unpublishedCompleted === 0}
                  onClick={() => setConfirmPublish(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40 hover:bg-primary/90 transition-colors"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}
                  نشر جميع المنتجات ({unpublishedCompleted})
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmPublish}
        title="نشر جميع المنتجات"
        description={`سيتم نشر ${unpublishedCompleted} منتج مكتمل وإظهارها في الكتالوج. المسودات غير المكتملة تبقى مخفية.`}
        confirmLabel="نشر الآن"
        onConfirm={() => void publishAll()}
        onCancel={() => setConfirmPublish(false)}
      />
    </div>
  );
}
