export type OrderStatus='draft'|'submitted'|'cancelled';
export interface LocalCustomer{id:string;name:string;phone:string;notes:string;isActive:boolean;createdAt:string;updatedAt:string}
export interface LocalOrderItem{id:string;productId:string;productName:string;quantity:number;bonusCartons?:number;bonusGallons?:number;sortOrder:number}
export interface LocalOrder{id:string;orderNumber?:number;customerId:string;customerName:string;status:OrderStatus;revision:number;items:LocalOrderItem[];createdAt:string;updatedAt:string;syncState:'local'|'synced'|'conflict';conflict?:unknown}
export interface PendingMutation{mutationId:string;deviceId:string;baseRevision:number;order:{id:string;customerId:string;customerName:string;status:OrderStatus;items:LocalOrderItem[];createdAt:string;updatedAt:string}}
const DB_NAME='sarda-orders-v1';let connection:Promise<IDBDatabase>|undefined;
function openDb():Promise<IDBDatabase>{if(!connection)connection=new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{for(const name of ['customers','orders','outbox'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name,{keyPath:name==='outbox'?'mutationId':'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return connection}
function run<T>(store:string,mode:IDBTransactionMode,fn:(s:IDBObjectStore)=>IDBRequest<T>):Promise<T>{return openDb().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);const r=fn(tx.objectStore(store));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);tx.onabort=()=>reject(tx.error)}))}
export const listLocalCustomers=()=>run<LocalCustomer[]>('customers','readonly',s=>s.getAll());
export const listLocalOrders=()=>run<LocalOrder[]>('orders','readonly',s=>s.getAll());
export const listOutbox=()=>run<PendingMutation[]>('outbox','readonly',s=>s.getAll());
export const saveLocalCustomer=(v:LocalCustomer)=>run('customers','readwrite',s=>s.put(v));
export const saveLocalOrder=(v:LocalOrder)=>run('orders','readwrite',s=>s.put(v));
export const saveMutation=(v:PendingMutation)=>run('outbox','readwrite',s=>s.put(v));
export const removeMutation=(id:string)=>run('outbox','readwrite',s=>s.delete(id));
export function getDeviceId(){let id=localStorage.getItem('sarda_orders_device_id');if(!id){id=crypto.randomUUID();localStorage.setItem('sarda_orders_device_id',id)}return id}
