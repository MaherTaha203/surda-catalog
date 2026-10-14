import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { listProducts } from '@/api/products';
import { readProductsSnapshot } from '@/lib/offline-db';
import { fetchCustomers, fetchRemoteOrders, syncCustomer, syncMutations } from '@/api/orders';
import {
  getDeviceId,
  listLocalCustomers,
  listLocalOrders,
  listOutbox,
  removeMutation,
  saveLocalCustomer,
  saveLocalOrder,
  saveMutation,
  type LocalCustomer,
  type LocalOrder,
  type PendingMutation,
} from '@/lib/orders-db';
import type { Product } from '@/types/product';
import {
  ArrowRight,
  Check,
  CheckSquare,
  Cloud,
  CloudOff,
  Loader2,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Square,
  Trash2,
  X,
} from 'lucide-react';

export const Route = createFileRoute('/orders')({
  head: () => ({ meta: [{ title: 'الطلبيات — سردا' }] }),
  component: OrdersPage,
});

const uid = () => crypto.randomUUID();

/** Normalise raw input to a non-negative integer (English numerals only). */
const toInt = (raw: string): number => {
  const trimmed = raw.replace(/[^\d]/g, '');
  if (trimmed === '') return 0;
  return Math.max(0, Math.min(999999, Math.floor(Number(trimmed) || 0)));
};

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-CA');
  } catch {
    return '';
  }
};

type View = 'entry' | 'review';

function OrdersPage() {
  // ── Data ────────────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState<LocalCustomer[]>([]);
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // ── Navigation / view ─────────────────────────────────────────────────────
  const [view, setView] = useState<View>('entry');

  // ── Entry state ─────────────────────────────────────────────────────────
  const [activeId, setActiveId] = useState('');
  const [chosenCustomer, setChosenCustomer] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [phone, setPhone] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  const [bonusDrafts, setBonusDrafts] = useState<Record<string, string>>({});
  const [cartOpen, setCartOpen] = useState(false);

  // ── Review state ──────────────────────────────────────────────────────────
  const [savedQuery, setSavedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LocalOrder['status']>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [printScope, setPrintScope] = useState<string[]>([]);

  // ── Shared ──────────────────────────────────────────────────────────────
  const [notice, setNotice] = useState<{ kind: 'info' | 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' && navigator.onLine);
  const savingRef = useRef(false);

  const flash = useCallback((kind: 'info' | 'error' | 'success', text: string) => setNotice({ kind, text }), []);

  // ── Loaders ───────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setCustomers(await listLocalCustomers());
    setOrders((await listLocalOrders()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }, []);

  const loadSaved = useCallback(async () => {
    const local = await listLocalOrders();
    let remote: LocalOrder[] = [];
    if (navigator.onLine) {
      try {
        const result = await fetchRemoteOrders();
        remote = (Array.isArray(result) ? result : []).map((o: any) => ({
          ...o,
          items: (o.items || []).map((i: any) => ({ ...i, productName: i.productName || i.productNameSnapshot || 'صنف' })),
          syncState: 'synced' as const,
        }));
        for (const o of remote) if (!local.some((v) => v.id === o.id)) await saveLocalOrder(o);
      } catch {
        /* offline / transient — keep local view */
      }
    }
    const merged = new Map<string, LocalOrder>();
    for (const o of remote) merged.set(o.id, o);
    for (const o of local) merged.set(o.id, o);
    setOrders([...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }, []);

  useEffect(() => {
    void refresh();
    setProducts(readProductsSnapshot());
    void listProducts().then(setProducts).catch(() => {});
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [refresh]);

  // Auto-dismiss transient notices.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const current = orders.find((o) => o.id === activeId);

  // ── Persistence (single source of truth — never bypass this) ──────────────
  const persist = useCallback(
    async (o: LocalOrder) => {
      const next = { ...o, updatedAt: new Date().toISOString(), syncState: 'local' as const };
      await saveLocalOrder(next);
      const queue = await listOutbox();
      const old = queue.find((v) => v.order.id === o.id);
      if (old) await removeMutation(old.mutationId);
      const m: PendingMutation = {
        mutationId: uid(),
        deviceId: getDeviceId(),
        baseRevision: o.revision,
        order: {
          id: o.id,
          customerId: o.customerId,
          customerName: o.customerName,
          status: o.status,
          items: o.items,
          createdAt: o.createdAt,
          updatedAt: next.updatedAt,
        },
      };
      await saveMutation(m);
      await refresh();
    },
    [refresh],
  );

  // ── Order lifecycle ───────────────────────────────────────────────────────
  const newOrderFor = async (c: LocalCustomer) => {
    const now = new Date().toISOString();
    const o: LocalOrder = {
      id: uid(),
      customerId: c.id,
      customerName: c.name,
      status: 'draft',
      revision: 0,
      items: [],
      createdAt: now,
      updatedAt: now,
      syncState: 'local',
    };
    await saveLocalOrder(o);
    setActiveId(o.id);
    setChosenCustomer(c.id);
    setCustomerQuery('');
    setProductFilter('');
    setCategory('all');
    setQtyDrafts({});
    setBonusDrafts({});
    setNotice(null);
    await refresh();
  };

  const startOrder = async () => {
    let c = customers.find((v) => v.id === chosenCustomer);
    if (!c) {
      if (!customerQuery.trim()) {
        flash('error', 'ابحث عن اسم الزبون أو اكتبه أولاً');
        return;
      }
      const now = new Date().toISOString();
      c = {
        id: uid(),
        name: customerQuery.trim(),
        phone: phone.trim(),
        notes: '',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      await saveLocalCustomer(c);
      setCustomers((v) => [...v, c as LocalCustomer]);
    }
    await newOrderFor(c);
    setPhone('');
  };

  const resetEntry = () => {
    setActiveId('');
    setChosenCustomer('');
    setPhone('');
    setCustomerQuery('');
    setProductFilter('');
    setCategory('all');
    setQtyDrafts({});
    setBonusDrafts({});
    setCartOpen(false);
  };

  const closeOrder = () => {
    if (!current) return;
    if (
      confirm('إغلاق شاشة الطلبية؟ ستبقى الطلبية محفوظة كمسودة ويمكن فتحها لاحقاً من الطلبيات المحفوظة.')
    ) {
      resetEntry();
      flash('info', 'أُغلقت شاشة الطلبية ولم تُحذف. تجدها في الطلبيات المحفوظة.');
    }
  };

  const approveOrder = async () => {
    if (!current || savingRef.current) return;
    if (current.items.length === 0) {
      flash('error', 'أضف صنفاً واحداً على الأقل قبل حفظ الطلبية');
      return;
    }
    savingRef.current = true;
    setBusy(true);
    try {
      await persist({ ...current, status: 'submitted' });
      resetEntry();
      setView('review');
      await loadSaved();
      flash('success', 'حُفظت الطلبية محلياً. اضغط «مزامنة» لإرسالها إلى الخادم عند توفر الاتصال.');
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };

  // ── Item editing (quantity + bonus) ────────────────────────────────────────
  const setQuantity = async (p: Product, value: number) => {
    if (!current) return;
    const old = current.items.find((i) => i.productId === p.id);
    const items =
      value <= 0
        ? current.items.filter((i) => i.productId !== p.id)
        : old
          ? current.items.map((i) => (i.productId === p.id ? { ...i, quantity: value } : i))
          : [
              ...current.items,
              {
                id: uid(),
                productId: p.id,
                productName: p.name,
                quantity: value,
                bonusCartons: 0,
                bonusGallons: 0,
                sortOrder: current.items.length,
              },
            ];
    await persist({ ...current, items });
  };

  const stepQuantity = async (p: Product, delta: number) => {
    if (!current) return;
    const old = current.items.find((i) => i.productId === p.id);
    await setQuantity(p, (old?.quantity ?? 0) + delta);
    setQtyDrafts((v) => {
      const next = { ...v };
      delete next[p.id];
      return next;
    });
  };

  const setBonus = async (p: Product, field: 'bonusCartons' | 'bonusGallons', raw: string) => {
    if (!current) return;
    const item = current.items.find((i) => i.productId === p.id);
    if (!item) return;
    const safe = toInt(raw);
    const items = current.items.map((i) => (i.productId === p.id ? { ...i, [field]: safe } : i));
    await persist({ ...current, items });
    setBonusDrafts((v) => {
      const next = { ...v };
      delete next[p.id + ':' + field];
      return next;
    });
  };

  // ── Conflict + sync (preserved from prior behaviour) ───────────────────────
  const resolveConflict = async (orderId: string, choice: 'local' | 'remote') => {
    const target = orders.find((o) => o.id === orderId);
    if (!target || !target.conflict || typeof target.conflict !== 'object') return;
    const remote = target.conflict as any;
    if (choice === 'remote') {
      const queue = await listOutbox();
      for (const m of queue) if (m.order.id === target.id) await removeMutation(m.mutationId);
      await saveLocalOrder({
        ...remote,
        items: (remote.items || []).map((i: any) => ({ ...i, productName: i.productName || i.productNameSnapshot })),
        syncState: 'synced',
        conflict: undefined,
      });
      flash('info', 'تم اعتماد النسخة الموجودة على الخادم.');
    } else {
      const queue = await listOutbox();
      const pending = queue.find((m) => m.order.id === target.id);
      if (!pending) {
        flash('error', 'لا يوجد تعديل محلي معلّق لإعادة إرساله.');
        return;
      }
      await removeMutation(pending.mutationId);
      await saveMutation({ ...pending, mutationId: uid(), baseRevision: Number(remote.revision) || 0 });
      await saveLocalOrder({ ...target, revision: Number(remote.revision) || 0, syncState: 'local', conflict: undefined });
      flash('info', 'احتُفظ بتعديل هذا الجهاز؛ اضغط مزامنة لإرساله مجدداً.');
    }
    await refresh();
  };

  const sync = async () => {
    if (!navigator.onLine) {
      flash('info', 'دون اتصال؛ التغييرات محفوظة على الجهاز وستُرسل عند عودة الاتصال.');
      return;
    }
    setSyncing(true);
    setBusy(true);
    try {
      for (const c of await listLocalCustomers()) await syncCustomer(c);
      const remoteCustomers = await fetchCustomers();
      for (const c of remoteCustomers) {
        const local = (await listLocalCustomers()).find((v) => v.id === c.id);
        if (!local) await saveLocalCustomer({ ...c, isActive: Boolean(c.isActive) });
      }
      const queue = await listOutbox();
      if (queue.length) {
        const res = await syncMutations(queue);
        for (const r of res.results) {
          const m = queue.find((v) => v.mutationId === r.mutationId);
          if (!m) continue;
          if (r.status === 'conflict') {
            const local = (await listLocalOrders()).find((v) => v.id === m.order.id);
            if (local) await saveLocalOrder({ ...local, syncState: 'conflict', conflict: r.current });
            continue;
          }
          await removeMutation(r.mutationId);
          if (r.order)
            await saveLocalOrder({
              ...r.order,
              syncState: 'synced',
              items: (r.order.items || []).map((i: any) => ({ ...i, productName: i.productName || i.productNameSnapshot })),
            });
        }
      }
      const remoteOrders = await fetchRemoteOrders();
      const queuedIds = new Set((await listOutbox()).map((m) => m.order.id));
      const localOrders = await listLocalOrders();
      for (const remote of remoteOrders) {
        const local = localOrders.find((o) => o.id === remote.id);
        if (queuedIds.has(remote.id) || local?.syncState === 'conflict') continue;
        await saveLocalOrder({
          ...remote,
          items: (remote.items || []).map((i: any) => ({ ...i, productName: i.productName || i.productNameSnapshot })),
          syncState: 'synced',
        });
      }
      await refresh();
      const conflicts = (await listLocalOrders()).filter((o) => o.syncState === 'conflict').length;
      flash(conflicts ? 'error' : 'success', conflicts ? `اكتملت المزامنة مع ${conflicts} تعارض يحتاج مراجعة.` : 'اكتملت المزامنة بنجاح.');
    } catch {
      flash('error', 'تعذّرت المزامنة؛ لم تُحذف أي تغييرات محلية. حاول مجدداً.');
    } finally {
      setSyncing(false);
      setBusy(false);
    }
  };

  // ── Derived: products / categories ──────────────────────────────────────────
  const visibleProducts = useMemo(() => products.filter((p) => !p.isHidden), [products]);
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of visibleProducts) if (p.category) set.add(p.category);
    return [...set];
  }, [visibleProducts]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const filteredProducts = useMemo(() => {
    const q = productFilter.trim().toLocaleLowerCase();
    return visibleProducts.filter((p) => {
      if (category !== 'all' && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLocaleLowerCase().includes(q) ||
        (p.category || '').toLocaleLowerCase().includes(q) ||
        (p.size || '').toLocaleLowerCase().includes(q)
      );
    });
  }, [visibleProducts, productFilter, category]);

  // ── Derived: order totals (estimate from current catalog prices) ────────────
  const orderEstimate = (o: LocalOrder) =>
    o.items.reduce((sum, i) => sum + (productById.get(i.productId)?.cartonPrice ?? 0) * i.quantity, 0);
  const totalUnits = (o: LocalOrder) => o.items.reduce((s, i) => s + i.quantity, 0);

  // ── Derived: review list ────────────────────────────────────────────────────
  const savedShown = useMemo(() => {
    const q = savedQuery.trim().toLocaleLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(o.customerName ?? '').toLocaleLowerCase().includes(q) ||
        String(o.orderNumber ?? '').includes(savedQuery.trim())
      );
    });
  }, [orders, savedQuery, statusFilter]);

  const printOrders = orders.filter((o) => printScope.includes(o.id));

  const doPrint = (ids: string[]) => {
    if (ids.length === 0) return;
    setPrintScope(ids);
    setTimeout(() => {
      window.print();
    }, 60);
  };

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const statusLabel = (s: LocalOrder['status']) =>
    s === 'submitted' ? 'محفوظة' : s === 'cancelled' ? 'ملغاة' : 'مسودة';
  const syncLabel = (s: LocalOrder['syncState']) =>
    s === 'conflict' ? 'تعارض' : s === 'synced' ? 'متزامنة' : 'محلية';

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <>
    <PrintStyles />
    <main dir="rtl" className="orders-main min-h-dvh bg-background text-foreground">

      {/* Top app bar */}
      <header className="no-print sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <a
              href="/catalog"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted"
              title="العودة للكاتالوج"
              aria-label="العودة للكاتالوج"
            >
              <ArrowRight size={18} />
            </a>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold leading-tight">الطلبيات</h1>
              <p className="truncate text-xs text-muted-foreground">تسجيل ومراجعة وطباعة — ضمن صفحة واحدة</p>
            </div>
          </div>

          <div className="order-last flex w-full items-center gap-2 sm:order-none sm:ms-auto sm:w-auto">
            {/* Segmented view switch */}
            <div className="flex rounded-lg border border-border bg-muted/40 p-0.5 text-sm">
              <button
                onClick={() => setView('entry')}
                className={
                  'rounded-md px-3 py-1.5 font-medium transition ' +
                  (view === 'entry' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')
                }
              >
                تسجيل طلبية
              </button>
              <button
                onClick={() => {
                  setView('review');
                  void loadSaved();
                }}
                className={
                  'rounded-md px-3 py-1.5 font-medium transition ' +
                  (view === 'review' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')
                }
              >
                الطلبيات المحفوظة
              </button>
            </div>

            <span
              className={
                'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ' +
                (online ? 'border-border text-muted-foreground' : 'border-destructive/40 text-destructive')
              }
              title={online ? 'متصل بالإنترنت' : 'تعمل دون اتصال'}
            >
              {online ? <Cloud size={15} /> : <CloudOff size={15} />}
              <span className="hidden sm:inline">{online ? 'متصل' : 'دون اتصال'}</span>
            </span>

            <button
              disabled={busy || !online}
              onClick={() => void sync()}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              title="مزامنة مع الخادم"
            >
              {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              <span className="hidden sm:inline">مزامنة</span>
            </button>
          </div>
        </div>

        {notice && (
          <div className="mx-auto max-w-7xl px-4 pb-3">
            <p
              role="status"
              className={
                'rounded-lg border px-3 py-2 text-sm ' +
                (notice.kind === 'error'
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : notice.kind === 'success'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-border bg-muted/50 text-foreground')
              }
            >
              {notice.text}
            </p>
          </div>
        )}
      </header>

      {view === 'entry' ? (
        <EntryView
          current={current}
          customers={customers}
          chosenCustomer={chosenCustomer}
          setChosenCustomer={setChosenCustomer}
          customerQuery={customerQuery}
          setCustomerQuery={setCustomerQuery}
          phone={phone}
          setPhone={setPhone}
          startOrder={startOrder}
          busy={busy}
          productFilter={productFilter}
          setProductFilter={setProductFilter}
          category={category}
          setCategory={setCategory}
          categories={categories}
          filteredProducts={filteredProducts}
          qtyDrafts={qtyDrafts}
          setQtyDrafts={setQtyDrafts}
          bonusDrafts={bonusDrafts}
          setBonusDrafts={setBonusDrafts}
          setQuantity={setQuantity}
          stepQuantity={stepQuantity}
          setBonus={setBonus}
          productById={productById}
          orderEstimate={orderEstimate}
          totalUnits={totalUnits}
          approveOrder={approveOrder}
          closeOrder={closeOrder}
          resolveConflict={resolveConflict}
          syncLabel={syncLabel}
          cartOpen={cartOpen}
          setCartOpen={setCartOpen}
          doPrint={doPrint}
        />
      ) : (
        <ReviewView
          savedShown={savedShown}
          savedQuery={savedQuery}
          setSavedQuery={setSavedQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          selected={selected}
          setSelected={setSelected}
          toggleSelected={toggleSelected}
          expanded={expanded}
          toggleExpanded={toggleExpanded}
          loadSaved={loadSaved}
          doPrint={doPrint}
          startNew={() => {
            resetEntry();
            setView('entry');
          }}
          orderEstimate={orderEstimate}
          totalUnits={totalUnits}
          statusLabel={statusLabel}
          syncLabel={syncLabel}
          resolveConflict={resolveConflict}
        />
      )}

    </main>
    {/* Hidden print surface — sibling of <main> so it paginates in normal flow */}
    <PrintSheet orders={printOrders} />
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Entry view
// ────────────────────────────────────────────────────────────────────────────
interface EntryProps {
  current: LocalOrder | undefined;
  customers: LocalCustomer[];
  chosenCustomer: string;
  setChosenCustomer: (v: string) => void;
  customerQuery: string;
  setCustomerQuery: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  startOrder: () => void;
  busy: boolean;
  productFilter: string;
  setProductFilter: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  categories: string[];
  filteredProducts: Product[];
  qtyDrafts: Record<string, string>;
  setQtyDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  bonusDrafts: Record<string, string>;
  setBonusDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setQuantity: (p: Product, v: number) => void;
  stepQuantity: (p: Product, d: number) => void;
  setBonus: (p: Product, f: 'bonusCartons' | 'bonusGallons', raw: string) => void;
  productById: Map<string, Product>;
  orderEstimate: (o: LocalOrder) => number;
  totalUnits: (o: LocalOrder) => number;
  approveOrder: () => void;
  closeOrder: () => void;
  resolveConflict: (id: string, c: 'local' | 'remote') => void;
  syncLabel: (s: LocalOrder['syncState']) => string;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  doPrint: (ids: string[]) => void;
}

function EntryView(props: EntryProps) {
  const { current } = props;

  if (!current) return <CustomerPicker {...props} />;

  return (
    <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[1fr_360px]">
      {/* Product catalog */}
      <section className="min-w-0 space-y-3">
        {current.syncState === 'conflict' && <ConflictBanner order={current} resolveConflict={props.resolveConflict} />}

        <div className="sticky top-[73px] z-20 -mx-4 space-y-2 border-b border-border bg-background/95 px-4 pb-3 pt-1 backdrop-blur lg:top-[65px]">
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={props.productFilter}
              onChange={(e) => props.setProductFilter(e.target.value)}
              placeholder="بحث سريع عن صنف بالاسم أو الحجم…"
              className="w-full rounded-lg border border-border bg-card p-3 pe-10 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {props.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <CategoryChip active={props.category === 'all'} onClick={() => props.setCategory('all')}>
                الكل
              </CategoryChip>
              {props.categories.map((c) => (
                <CategoryChip key={c} active={props.category === c} onClick={() => props.setCategory(c)}>
                  {c}
                </CategoryChip>
              ))}
            </div>
          )}
        </div>

        {props.filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            لا توجد أصناف مطابقة للبحث.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {props.filteredProducts.map((p) => (
              <ProductTile
                key={p.id}
                product={p}
                item={current.items.find((i) => i.productId === p.id)}
                qtyDraft={props.qtyDrafts[p.id]}
                onQtyInput={(raw) => {
                  props.setQtyDrafts((v) => ({ ...v, [p.id]: raw }));
                  props.setQuantity(p, toInt(raw));
                }}
                onQtyBlur={() =>
                  props.setQtyDrafts((v) => {
                    const next = { ...v };
                    delete next[p.id];
                    return next;
                  })
                }
                onStep={(d) => props.stepQuantity(p, d)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Order cart — sticky on desktop, bottom sheet on mobile */}
      <OrderCart {...props} current={current} />

      {/* Mobile floating cart button */}
      <button
        onClick={() => props.setCartOpen(true)}
        className="no-print fixed bottom-4 start-4 z-30 flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-lg lg:hidden"
      >
        <CheckSquare size={18} /> السلة ({current.items.length})
      </button>
    </div>
  );
}

function CustomerPicker(props: EntryProps) {
  const query = props.customerQuery.trim().toLocaleLowerCase();
  const matches = props.customers
    .filter((c) => c.isActive && String(c.name ?? '').toLocaleLowerCase().includes(query))
    .slice(0, 8);
  const exact = props.customers.some(
    (c) => c.isActive && String(c.name ?? '').toLocaleLowerCase() === props.customerQuery.trim().toLocaleLowerCase(),
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">بدء طلبية جديدة</h2>
          <p className="text-sm text-muted-foreground">اختر الزبون من القائمة أو اكتب اسماً جديداً للبدء.</p>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium">اسم الزبون</span>
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              autoComplete="off"
              value={props.customerQuery}
              onChange={(e) => {
                props.setCustomerQuery(e.target.value);
                props.setChosenCustomer('');
              }}
              placeholder="اكتب اسم الزبون…"
              className="w-full rounded-lg border border-border bg-background p-3 pe-10 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </label>

        {!props.chosenCustomer && props.customerQuery.trim() && (
          <div className="max-h-60 space-y-1 overflow-auto rounded-lg border border-border p-1.5">
            {matches.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  props.setChosenCustomer(c.id);
                  props.setCustomerQuery(c.name);
                  props.setPhone(c.phone || '');
                }}
                className="block w-full rounded-md p-3 text-right transition hover:bg-muted"
              >
                <b>{c.name}</b>
                {c.phone && <small className="block text-muted-foreground" dir="ltr">{c.phone}</small>}
              </button>
            ))}
            {!exact && (
              <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Plus size={15} /> إنشاء زبون جديد باسم «{props.customerQuery.trim()}»
              </p>
            )}
          </div>
        )}

        {props.chosenCustomer && (
          <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/5 p-3">
            <span className="text-sm">
              الزبون المحدد: <b>{props.customers.find((c) => c.id === props.chosenCustomer)?.name || props.customerQuery}</b>
            </span>
            <button
              onClick={() => {
                props.setChosenCustomer('');
                props.setCustomerQuery('');
                props.setPhone('');
              }}
              className="text-sm font-medium text-primary underline"
            >
              تغيير
            </button>
          </div>
        )}

        <label className="block space-y-2">
          <span className="text-sm font-medium">الهاتف (اختياري)</span>
          <input
            value={props.phone}
            onChange={(e) => props.setPhone(e.target.value)}
            inputMode="tel"
            dir="ltr"
            placeholder="05xxxxxxxx"
            className="w-full rounded-lg border border-border bg-background p-3 text-left outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <button
          onClick={() => props.startOrder()}
          disabled={props.busy || (!props.chosenCustomer && !props.customerQuery.trim())}
          className="w-full rounded-lg bg-primary p-3 text-base font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          بدء الطلبية
        </button>
        <p className="text-xs text-muted-foreground">
          تُحفظ الكميات تلقائياً أثناء الإدخال. بعد حفظ الطلبية تنتقل مباشرةً إلى شاشة المراجعة والطباعة ضمن الرابط نفسه.
        </p>
      </div>
    </div>
  );
}

function OrderCart(props: EntryProps) {
  const { current } = props;
  if (!current) return null;
  const items = [...current.items].sort((a, b) => a.sortOrder - b.sortOrder);
  const estimate = props.orderEstimate(current);

  const body = (
    <>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{current.customerName || 'زبون غير مسمى'}</p>
          <p className="text-xs text-muted-foreground">
            {items.length} صنف · {props.syncLabel(current.syncState)}
          </p>
        </div>
        <button
          onClick={() => props.setCartOpen(false)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted lg:hidden"
          aria-label="إغلاق السلة"
        >
          <X size={18} />
        </button>
      </div>

      <div className="max-h-[calc(100dvh-320px)] flex-1 overflow-auto px-2 py-2 lg:max-h-[calc(100dvh-260px)]">
        {items.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-muted-foreground">
            لم تُضف أصناف بعد. اختر صنفاً من القائمة لإضافته إلى الطلبية.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((i) => {
              const p = props.productById.get(i.productId);
              return (
                <li key={i.id} className="rounded-lg border border-border bg-background p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{i.productName}</p>
                    <button
                      onClick={() => p && props.setQuantity(p, 0)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
                      aria-label={'حذف ' + i.productName}
                      title="حذف الصنف"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Stepper
                      value={props.qtyDrafts[i.productId] ?? String(i.quantity)}
                      onInput={(raw) => {
                        props.setQtyDrafts((v) => ({ ...v, [i.productId]: raw }));
                        if (p) props.setQuantity(p, toInt(raw));
                      }}
                      onBlur={() =>
                        props.setQtyDrafts((v) => {
                          const next = { ...v };
                          delete next[i.productId];
                          return next;
                        })
                      }
                      onStep={(d) => p && props.stepQuantity(p, d)}
                      label={i.productName}
                    />
                    {p && p.cartonPrice > 0 && (
                      <span className="ms-auto text-xs tabular-nums text-muted-foreground" dir="ltr">
                        {(p.cartonPrice * i.quantity).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <BonusInput
                      label="بونص كراتين"
                      value={props.bonusDrafts[i.productId + ':bonusCartons'] ?? String(i.bonusCartons ?? 0)}
                      onInput={(raw) => props.setBonusDrafts((v) => ({ ...v, [i.productId + ':bonusCartons']: raw }))}
                      onCommit={(raw) => p && props.setBonus(p, 'bonusCartons', raw)}
                    />
                    <BonusInput
                      label="بونص جالونات"
                      value={props.bonusDrafts[i.productId + ':bonusGallons'] ?? String(i.bonusGallons ?? 0)}
                      onInput={(raw) => props.setBonusDrafts((v) => ({ ...v, [i.productId + ':bonusGallons']: raw }))}
                      onCommit={(raw) => p && props.setBonus(p, 'bonusGallons', raw)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2 border-t border-border p-3">
        {estimate > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">القيمة التقديرية</span>
            <span className="font-semibold tabular-nums" dir="ltr">
              {estimate.toFixed(2)}
            </span>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => props.closeOrder()}
            className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-medium transition hover:bg-muted"
          >
            إغلاق
          </button>
          <button
            disabled={props.busy || current.items.length === 0}
            onClick={() => props.approveOrder()}
            className="flex flex-[2] items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {props.busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} حفظ الطلبية
          </button>
        </div>
        {estimate > 0 && (
          <p className="text-center text-[11px] text-muted-foreground">القيمة تقديرية حسب أسعار الكاتالوج الحالية.</p>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sticky panel */}
      <aside className="no-print sticky top-[81px] hidden h-fit flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card lg:flex">
        {body}
      </aside>

      {/* Mobile bottom sheet */}
      {props.cartOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => props.setCartOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl bg-card shadow-xl">
            {body}
          </div>
        </div>
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Review view
// ────────────────────────────────────────────────────────────────────────────
interface ReviewProps {
  savedShown: LocalOrder[];
  savedQuery: string;
  setSavedQuery: (v: string) => void;
  statusFilter: 'all' | LocalOrder['status'];
  setStatusFilter: (v: 'all' | LocalOrder['status']) => void;
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleSelected: (id: string) => void;
  expanded: Set<string>;
  toggleExpanded: (id: string) => void;
  loadSaved: () => void;
  doPrint: (ids: string[]) => void;
  startNew: () => void;
  orderEstimate: (o: LocalOrder) => number;
  totalUnits: (o: LocalOrder) => number;
  statusLabel: (s: LocalOrder['status']) => string;
  syncLabel: (s: LocalOrder['syncState']) => string;
  resolveConflict: (id: string, c: 'local' | 'remote') => void;
}

function ReviewView(props: ReviewProps) {
  const selectedVisible = props.savedShown.filter((o) => props.selected.has(o.id));
  const allVisibleSelected = props.savedShown.length > 0 && props.savedShown.every((o) => props.selected.has(o.id));

  const statuses: Array<'all' | LocalOrder['status']> = ['all', 'submitted', 'draft', 'cancelled'];

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-4">
      {/* Toolbar */}
      <div className="no-print space-y-3 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={17} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={props.savedQuery}
              onChange={(e) => props.setSavedQuery(e.target.value)}
              placeholder="ابحث باسم الزبون أو رقم الطلبية…"
              className="w-full rounded-lg border border-border bg-background p-2.5 pe-10 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            onClick={() => props.loadSaved()}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-medium transition hover:bg-muted"
          >
            <RefreshCw size={15} /> تحديث
          </button>
          <button
            onClick={() => props.startNew()}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Plus size={15} /> طلبية جديدة
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {statuses.map((s) => (
            <CategoryChip key={s} active={props.statusFilter === s} onClick={() => props.setStatusFilter(s)}>
              {s === 'all' ? 'الكل' : props.statusLabel(s)}
            </CategoryChip>
          ))}
        </div>

        {/* Bulk / print row */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <button
            onClick={() =>
              props.setSelected((prev) => {
                if (allVisibleSelected) return new Set();
                return new Set(props.savedShown.map((o) => o.id));
              })
            }
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted"
          >
            {allVisibleSelected ? <CheckSquare size={15} /> : <Square size={15} />}
            {allVisibleSelected ? 'إلغاء التحديد' : 'تحديد الظاهر'}
          </button>
          <button
            disabled={selectedVisible.length === 0}
            onClick={() => props.doPrint(selectedVisible.map((o) => o.id))}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted disabled:opacity-50"
          >
            <Printer size={15} /> طباعة المحدد ({selectedVisible.length})
          </button>
          <button
            disabled={props.savedShown.length === 0}
            onClick={() => props.doPrint(props.savedShown.map((o) => o.id))}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            <Printer size={15} /> طباعة الظاهر ({props.savedShown.length})
          </button>
        </div>
      </div>

      {/* List */}
      {props.savedShown.length === 0 ? (
        <div className="no-print rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          لا توجد طلبيات مطابقة. احفظ طلبية من شاشة التسجيل لتظهر هنا.
        </div>
      ) : (
        <div className="no-print space-y-2.5">
          {props.savedShown.map((o) => (
            <OrderRow
              key={o.id}
              order={o}
              selected={props.selected.has(o.id)}
              expanded={props.expanded.has(o.id)}
              onToggleSelect={() => props.toggleSelected(o.id)}
              onToggleExpand={() => props.toggleExpanded(o.id)}
              onPrint={() => props.doPrint([o.id])}
              estimate={props.orderEstimate(o)}
              units={props.totalUnits(o)}
              statusLabel={props.statusLabel}
              syncLabel={props.syncLabel}
              resolveConflict={props.resolveConflict}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderRow(props: {
  order: LocalOrder;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onPrint: () => void;
  estimate: number;
  units: number;
  statusLabel: (s: LocalOrder['status']) => string;
  syncLabel: (s: LocalOrder['syncState']) => string;
  resolveConflict: (id: string, c: 'local' | 'remote') => void;
}) {
  const { order: o } = props;
  return (
    <article className={'rounded-xl border bg-card transition ' + (props.selected ? 'border-primary ring-1 ring-primary/30' : 'border-border')}>
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={props.onToggleSelect}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted"
          aria-label="تحديد الطلبية"
        >
          {props.selected ? <CheckSquare size={17} className="text-primary" /> : <Square size={17} />}
        </button>

        <button onClick={props.onToggleExpand} className="min-w-0 flex-1 text-right">
          <div className="flex items-center gap-2">
            <span className="truncate font-bold">{o.customerName || 'زبون غير مسمى'}</span>
            <span
              className={
                'rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                (o.status === 'submitted'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : o.status === 'cancelled'
                    ? 'bg-destructive/15 text-destructive'
                    : 'bg-muted text-muted-foreground')
              }
            >
              {props.statusLabel(o.status)}
            </span>
            {o.syncState === 'conflict' && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                تعارض
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {o.orderNumber ? 'طلبية #' + o.orderNumber : 'محلية'} · {fmtDate(o.createdAt)} · {o.items.length} صنف ·{' '}
            {props.units} وحدة
          </p>
        </button>

        <button
          onClick={props.onPrint}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted"
          aria-label="طباعة الطلبية"
          title="طباعة هذه الطلبية"
        >
          <Printer size={16} />
        </button>
      </div>

      {o.syncState === 'conflict' && (
        <div className="px-3 pb-3">
          <ConflictBanner order={o} resolveConflict={props.resolveConflict} />
        </div>
      )}

      {props.expanded && (
        <div className="border-t border-border p-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="p-2 text-right font-medium">الصنف</th>
                  <th className="p-2 text-center font-medium">الكمية</th>
                  <th className="p-2 text-center font-medium">بونص كراتين</th>
                  <th className="p-2 text-center font-medium">بونص جالونات</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <td className="p-2">{i.productName}</td>
                    <td className="p-2 text-center tabular-nums">{i.quantity}</td>
                    <td className="p-2 text-center tabular-nums">{i.bonusCartons || 0}</td>
                    <td className="p-2 text-center tabular-nums">{i.bonusGallons || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {props.estimate > 0 && (
            <p className="mt-2 text-end text-sm text-muted-foreground">
              القيمة التقديرية:{' '}
              <span className="font-semibold tabular-nums text-foreground" dir="ltr">
                {props.estimate.toFixed(2)}
              </span>
            </p>
          )}
        </div>
      )}
    </article>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Shared presentational pieces
// ────────────────────────────────────────────────────────────────────────────
function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        'rounded-full border px-3 py-1 text-sm font-medium transition ' +
        (active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted')
      }
    >
      {children}
    </button>
  );
}

function Stepper(props: {
  value: string;
  onInput: (raw: string) => void;
  onBlur: () => void;
  onStep: (d: number) => void;
  label: string;
}) {
  return (
    <div className="grid grid-cols-[36px_minmax(0,1fr)_36px] items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
      <button
        aria-label={'زيادة كمية ' + props.label}
        onClick={() => props.onStep(1)}
        className="flex h-8 items-center justify-center rounded-md bg-card text-foreground transition hover:bg-background"
        title="زيادة"
      >
        <Plus size={16} />
      </button>
      <input
        aria-label={'كمية ' + props.label}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={props.value === '0' ? '' : props.value}
        placeholder="0"
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => props.onInput(e.target.value)}
        onBlur={props.onBlur}
        className="h-8 w-full min-w-0 rounded-md border-0 bg-transparent text-center font-semibold tabular-nums outline-none"
      />
      <button
        aria-label={'تقليل كمية ' + props.label}
        onClick={() => props.onStep(-1)}
        disabled={props.value === '0' || props.value === ''}
        className="flex h-8 items-center justify-center rounded-md bg-card text-foreground transition hover:bg-background disabled:opacity-40"
        title="تقليل"
      >
        <Minus size={16} />
      </button>
    </div>
  );
}

function BonusInput(props: { label: string; value: string; onInput: (raw: string) => void; onCommit: (raw: string) => void }) {
  return (
    <label className="block text-[11px] font-medium text-muted-foreground">
      {props.label}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={props.value === '0' ? '' : props.value}
        placeholder="0"
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => props.onInput(e.target.value)}
        onBlur={(e) => props.onCommit(e.currentTarget.value)}
        className="mt-1 w-full rounded-md border border-border bg-background p-1.5 text-center text-sm tabular-nums text-foreground outline-none transition focus:border-primary"
      />
    </label>
  );
}

function ProductTile(props: {
  product: Product;
  item: LocalOrder['items'][number] | undefined;
  qtyDraft: string | undefined;
  onQtyInput: (raw: string) => void;
  onQtyBlur: () => void;
  onStep: (d: number) => void;
}) {
  const { product: p, item } = props;
  const active = (item?.quantity ?? 0) > 0;
  return (
    <article
      className={
        'flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card transition ' +
        (active ? 'border-primary ring-1 ring-primary/30' : 'border-border')
      }
    >
      <div className="relative flex h-24 items-center justify-center bg-muted/30 p-2">
        {p.imageUrl ? (
          <img src={p.imageUrl} alt={p.name} loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <span className="text-center text-xs text-muted-foreground">لا توجد صورة</span>
        )}
        {active && (
          <span className="absolute start-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check size={13} />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug">{p.name}</p>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          {p.size ? <span>{p.size}</span> : <span />}
          {p.cartonPrice > 0 && (
            <span className="tabular-nums" dir="ltr">
              {p.cartonPrice.toFixed(2)}
            </span>
          )}
        </div>
        <Stepper
          value={props.qtyDraft ?? String(item?.quantity ?? 0)}
          onInput={props.onQtyInput}
          onBlur={props.onQtyBlur}
          onStep={props.onStep}
          label={p.name}
        />
      </div>
    </article>
  );
}

function ConflictBanner(props: { order: LocalOrder; resolveConflict: (id: string, c: 'local' | 'remote') => void }) {
  return (
    <div className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/5 p-3">
      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
        عُدّلت هذه الطلبية على جهاز آخر. اختر النسخة التي تريد الاحتفاظ بها؛ لن يُحذف أي تعديل تلقائياً.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => props.resolveConflict(props.order.id, 'local')}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium transition hover:bg-muted"
        >
          الاحتفاظ بتعديل هذا الجهاز
        </button>
        <button
          onClick={() => props.resolveConflict(props.order.id, 'remote')}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium transition hover:bg-muted"
        >
          اعتماد نسخة الخادم
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Print
// ────────────────────────────────────────────────────────────────────────────
function PrintStyles() {
  return (
    <style>{`
      @page { size: A4; margin: 10mm; }
      #print-sheet { display: none; }
      @media print {
        /* Hide the live app; show only the print surface, kept in normal flow so
           long orders split across A4 pages instead of being clipped. */
        .orders-main { display: none !important; }
        #print-sheet { display: block !important; }
        .no-print { display: none !important; }

        /* An order may span several pages; allow the break but never split a row. */
        .print-order { break-inside: auto; border: 1px solid #999; border-radius: 6px; padding: 8px 11px; margin: 0 0 8px; }
        .print-order table { width: 100%; border-collapse: collapse; }
        .print-order tr { break-inside: avoid; page-break-inside: avoid; }

        /* thead reprints on every page the table spans → the order's header
           info (number + customer) and the column titles repeat on each page. */
        .print-order thead { display: table-header-group; }
        /* Shade the whole header block so each order is set off from the next. */
        .print-order thead th { background: #e4e9ef; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .print-order thead .phead-cell { padding: 5px 8px; border-bottom: 1.5px solid #666; }
        .print-order .phead { display: flex; align-items: baseline; gap: 10px; }
        .print-order .phead .pnum { font-weight: 700; font-size: 12pt; white-space: nowrap; }
        .print-order .phead .pcust { font-weight: 800; font-size: 14pt; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
        .print-order .phead .pdate { margin-inline-start: auto; font-size: 10pt; color: #555; white-space: nowrap; }
        .print-order thead .pcol { text-align: right; border-bottom: 1px solid #999; padding: 3px 6px; font-size: 9pt; color: #555; font-weight: 700; }
        .print-order tbody td { text-align: right; border-bottom: 1px solid #ccc; padding: 3px 6px; font-size: 10pt; }
        .print-order tbody td.pname { font-weight: 700; font-size: 11pt; }
        .print-order tbody td.pqty { font-weight: 800; font-size: 11pt; }
      }
    `}</style>
  );
}

function PrintSheet({ orders }: { orders: LocalOrder[] }) {
  return (
    <section id="print-sheet" dir="rtl" className="hidden">
      {orders.map((o) => (
        <article key={o.id} className="print-order">
          <table>
            <thead>
              <tr>
                <th className="phead-cell" colSpan={4}>
                  <div className="phead">
                    <span className="pnum">طلبية {o.orderNumber ? '#' + o.orderNumber : 'محلية'}</span>
                    <span className="pcust">{o.customerName || 'غير محدد'}</span>
                    <span className="pdate">{fmtDate(o.createdAt)}</span>
                  </div>
                </th>
              </tr>
              <tr>
                <th className="pcol">الصنف</th>
                <th className="pcol">الكمية</th>
                <th className="pcol">بونص كراتين</th>
                <th className="pcol">بونص جالونات</th>
              </tr>
            </thead>
            <tbody>
              {o.items.map((i) => (
                <tr key={i.id}>
                  <td className="pname">{i.productName}</td>
                  <td className="pqty">{i.quantity}</td>
                  <td>{i.bonusCartons || 0}</td>
                  <td>{i.bonusGallons || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ))}
    </section>
  );
}
