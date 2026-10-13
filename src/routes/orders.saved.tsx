import { useCallback,useEffect,useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ArrowRight,Printer,RefreshCw } from 'lucide-react';
import { fetchRemoteOrders } from '@/api/orders';
import { listLocalOrders,saveLocalOrder,type LocalOrder } from '@/lib/orders-db';

export const Route=createFileRoute('/orders/saved')({head:()=>({meta:[{title:'الطلبيات المحفوظة — سردا'}]}),component:SavedOrdersPage});

function SavedOrdersPage(){
 const [orders,setOrders]=useState<LocalOrder[]>([]);
 const [selected,setSelected]=useState<string[]>([]);
 const [query,setQuery]=useState('');
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const local=await listLocalOrders();
   let remote:LocalOrder[]=[];
   if(navigator.onLine){
    try{
     const result=await fetchRemoteOrders();
     remote=(Array.isArray(result)?result:[]).map((o:any)=>({...o,items:(o.items||[]).map((i:any)=>({...i,productName:i.productName||i.productNameSnapshot||'صنف'})),syncState:'synced' as const}));
     for(const o of remote){if(!local.some(v=>v.id===o.id))await saveLocalOrder(o)}
    }catch{ /* Keep locally saved orders visible when the server is unavailable. */ }
   }
   const merged=new Map<string,LocalOrder>();
   for(const o of remote)merged.set(o.id,o);
   for(const o of local)merged.set(o.id,o);
   setOrders([...merged.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));
   if(local.length===0&&remote.length===0)setError('لم نعثر على طلبيات محفوظة على هذا الجهاز أو على الخادم. إذا كانت الطلبية أُنشئت على جهاز آخر ولم تتم مزامنتها، افتح ذلك الجهاز واتصل بالإنترنت ثم نفّذ «مزامنة».');
  }catch{
   setError('تعذّر قراءة الطلبيات المحفوظة من هذا الجهاز. جرّب تحديث الصفحة؛ لم نحذف أي بيانات.');
  }finally{setLoading(false)}
 },[]);
 useEffect(()=>{void load()},[load]);
 const visible=orders.filter(o=>String(o.customerName??'').toLocaleLowerCase().includes(query.toLocaleLowerCase())||String(o.orderNumber??'').includes(query));
 const printOrders=selected.length?visible.filter(o=>selected.includes(o.id)):visible;
 return <main dir="rtl" className="min-h-dvh bg-background p-4 text-foreground">
 <style>{'@page{size:A4;margin:9mm}@media print{body *{visibility:hidden!important}#saved-print,#saved-print *{visibility:visible!important}#saved-print{display:block!important;position:absolute;top:0;right:0;width:100%}.no-print{display:none!important}.print-order{break-inside:avoid;page-break-inside:avoid;border:1px solid #999;padding:7px 9px;margin:0 0 8px;font-size:10pt}.print-order h2{font-size:12pt;margin:0 0 3px}.print-order p{margin:2px 0}table{width:100%;border-collapse:collapse}td,th{text-align:right;border-bottom:1px solid #bbb;padding:3px 5px;font-size:9pt}thead{display:table-header-group}}'}</style>
 <div className="no-print mx-auto max-w-6xl space-y-4">
 <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">الطلبيات المحفوظة</h1><p className="text-sm text-muted-foreground">الطلبيات المحفوظة محلياً والطلبيات التي تمت مزامنتها مع الخادم.</p></div><div className="flex flex-wrap gap-2"><a href="/orders" className="flex items-center gap-2 rounded border px-3 py-2"><ArrowRight size={16}/> إنشاء طلبية</a><button onClick={()=>window.print()} disabled={visible.length===0} className="flex items-center gap-2 rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"><Printer size={16}/> طباعة الظاهر</button><button onClick={()=>void load()} disabled={loading} className="flex items-center gap-2 rounded border px-3 py-2 disabled:opacity-50"><RefreshCw size={16}/> {loading?'جارٍ التحديث...':'تحديث'}</button></div></header>
 <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث باسم الزبون أو رقم الطلبية" className="w-full rounded-lg border bg-background p-3"/>
 {loading?<p className="rounded border p-4">جارٍ تحميل الطلبيات...</p>:error?<div role="status" className="space-y-3 rounded-xl border p-5"><p>{error}</p><button onClick={()=>void load()} className="rounded border px-3 py-2">إعادة المحاولة</button></div>:visible.length===0?<p className="rounded-xl border p-6 text-center text-muted-foreground">لا توجد طلبيات مطابقة للبحث.</p>:<div className="space-y-3">{visible.map(o=><article key={o.id} className="rounded-xl border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{o.customerName||'زبون غير مسمى'}</h2><p className="text-sm text-muted-foreground">{o.orderNumber?'رقم الطلبية: '+o.orderNumber:'طلبية محلية'} · {new Date(o.createdAt).toLocaleDateString('en-CA')} · {o.items.length} أصناف · {o.status==='draft'?'مسودة':o.status==='cancelled'?'ملغاة':'محفوظة'}</p><p className="mt-2 text-sm">{o.items.slice(0,3).map(i=>i.productName+' × '+i.quantity).join('، ')}{o.items.length>3?'، و'+(o.items.length-3)+' أصناف أخرى':''}</p></div><div className="flex flex-wrap items-center gap-2"><button onClick={()=>setSelected(v=>v.includes(o.id)?v.filter(id=>id!==o.id):[...v,o.id])} className={'rounded border px-3 py-2 text-sm '+(selected.includes(o.id)?'border-primary bg-primary/10':'')}>{selected.includes(o.id)?'محدد للطباعة':'تحديد للطباعة'}</button><button onClick={()=>{setSelected([o.id]);setTimeout(()=>window.print(),0)}} className="flex items-center gap-2 rounded border px-3 py-2 text-sm"><Printer size={15}/> طباعة الطلبية</button></div></div></article>)}</div>}
 <p className="text-xs text-muted-foreground">إغلاق الطلبية لا يحذفها. الطباعة مضغوطة وتُبقي كل طلبية كتلة واحدة قدر الإمكان.</p>
 </div>
 <section id="saved-print" className="hidden">{printOrders.map(o=><article key={o.id} className="print-order"><h2>شركة سردا — طلبية {o.orderNumber?'#'+o.orderNumber:'محلية'}</h2><p>الزبون: {o.customerName||'غير محدد'} · التاريخ: {new Date(o.createdAt).toLocaleDateString('en-CA')}</p><table><thead><tr><th>الصنف</th><th>الكمية</th><th>بونص كراتين</th><th>بونص جالونات</th></tr></thead><tbody>{o.items.map(i=><tr key={i.id}><td>{i.productName}</td><td>{i.quantity}</td><td>{i.bonusCartons||0}</td><td>{i.bonusGallons||0}</td></tr>)}</tbody></table></article>)}</section>
 </main>
}
