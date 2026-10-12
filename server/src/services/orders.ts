import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

export interface CustomerInput { id: string; name: string; phone?: string; notes?: string; }
export interface OrderItemInput { id: string; productId: string; productName: string; quantity: number; sortOrder?: number; }
export interface OrderMutation {
  mutationId: string;
  deviceId: string;
  baseRevision: number;
  order: { id: string; customerId: string; customerName: string; status: 'draft'|'submitted'|'cancelled'; items: OrderItemInput[]; createdAt?: string; updatedAt?: string; };
}
export class OrdersService {
  constructor(private readonly db: DatabaseSync) {}
  private cache = new Map<string, StatementSync>();
  private stmt(sql: string): StatementSync {
    let s=this.cache.get(sql); if(!s){s=this.db.prepare(sql);this.cache.set(sql,s);} return s;
  }
  private tx<T>(fn:()=>T):T { this.db.exec('BEGIN IMMEDIATE'); try { const v=fn(); this.db.exec('COMMIT'); return v; } catch(e) { this.db.exec('ROLLBACK'); throw e; } }
  listCustomers(includeInactive=false) {
    return this.stmt(`SELECT id,name,phone,notes,isActive,createdAt,updatedAt FROM customers ${includeInactive?'':'WHERE isActive=1'} ORDER BY name COLLATE NOCASE`).all();
  }
  saveCustomer(input: CustomerInput) {
    const name=input.name.trim(); if(!input.id.trim() || !name) throw new Error('CUSTOMER_ID_AND_NAME_REQUIRED');
    const now=new Date().toISOString();
    this.stmt(`INSERT INTO customers(id,name,phone,notes,isActive,createdAt,updatedAt)
      VALUES(?,?,?,?,1,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,phone=excluded.phone,notes=excluded.notes,updatedAt=excluded.updatedAt`)
      .run(input.id,name,input.phone?.trim()??'',input.notes?.trim()??'',now,now);
    return this.stmt('SELECT id,name,phone,notes,isActive,createdAt,updatedAt FROM customers WHERE id=?').get(input.id);
  }
  listOrders(query: { customerId?: string; from?: string; to?: string; search?: string } = {}) {
    const clauses:string[]=[]; const args: (string|number)[]=[];
    if(query.customerId){clauses.push('o.customerId=?');args.push(query.customerId);}
    if(query.from){clauses.push('substr(o.updatedAt,1,10)>=?');args.push(query.from);}
    if(query.to){clauses.push('substr(o.updatedAt,1,10)<=?');args.push(query.to);}
    if(query.search){clauses.push('(o.customerNameSnapshot LIKE ? OR CAST(o.orderNumber AS TEXT) LIKE ?)');args.push(`%${query.search}%`,`%${query.search}%`);}
    const rows=this.stmt(`SELECT o.* FROM orders o ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY o.updatedAt DESC`).all(...args) as Record<string,any>[];
    return rows.map(row=>({...row,items:this.stmt('SELECT id,productId,productNameSnapshot AS productName,quantity,sortOrder FROM order_items WHERE orderId=? ORDER BY sortOrder,id').all(row.id)}));
  }
  applyMutation(m: OrderMutation) {
    if(!m.mutationId?.trim() || !m.deviceId?.trim() || !m.order?.id?.trim() || !m.order.customerId?.trim()) throw new Error('INVALID_MUTATION');
    if(!Array.isArray(m.order.items) || m.order.items.some(i=>!i.id || !i.productId || !i.productName?.trim() || !Number.isSafeInteger(i.quantity) || i.quantity<1)) throw new Error('INVALID_ORDER_ITEMS');
    return this.tx(()=>{
      const prior=this.stmt('SELECT orderId,revision FROM order_mutations WHERE mutationId=?').get(m.mutationId) as {orderId:string;revision:number}|undefined;
      if(prior) return {status:'duplicate' as const, order:this.getOrder(prior.orderId)};
      const existing=this.stmt('SELECT revision,createdAt FROM orders WHERE id=?').get(m.order.id) as {revision:number;createdAt:string}|undefined;
      if((existing?.revision??0)!==m.baseRevision) return {status:'conflict' as const, current:this.getOrder(m.order.id)};
      const now=new Date().toISOString(); const revision=(existing?.revision??0)+1;
      let orderNumber: number|null=null;
      if(!existing) orderNumber=Number((this.stmt('SELECT COALESCE(MAX(orderNumber),0)+1 AS n FROM orders').get() as {n:number}).n);
      this.stmt(`INSERT INTO orders(id,orderNumber,customerId,customerNameSnapshot,status,revision,lastMutationId,lastDeviceId,createdAt,updatedAt)
        VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET customerId=excluded.customerId,customerNameSnapshot=excluded.customerNameSnapshot,status=excluded.status,revision=excluded.revision,lastMutationId=excluded.lastMutationId,lastDeviceId=excluded.lastDeviceId,updatedAt=excluded.updatedAt`)
        .run(m.order.id,orderNumber,m.order.customerId,m.order.customerName,m.order.status,revision,m.mutationId,m.deviceId,existing?.createdAt??m.order.createdAt??now,now);
      this.stmt('DELETE FROM order_items WHERE orderId=?').run(m.order.id);
      const itemStmt=this.stmt('INSERT INTO order_items(id,orderId,productId,productNameSnapshot,quantity,sortOrder) VALUES(?,?,?,?,?,?)');
      m.order.items.forEach((item,index)=>itemStmt.run(item.id,m.order.id,item.productId,item.productName,item.quantity,item.sortOrder??index));
      this.stmt('INSERT INTO order_mutations(mutationId,orderId,deviceId,revision,receivedAt) VALUES(?,?,?,?,?)').run(m.mutationId,m.order.id,m.deviceId,revision,now);
      return {status:'applied' as const,order:this.getOrder(m.order.id)};
    });
  }
  getOrder(id:string) {
    const row=this.stmt('SELECT * FROM orders WHERE id=?').get(id) as Record<string,any>|undefined;
    if(!row)return null;
    return {...row,items:this.stmt('SELECT id,productId,productNameSnapshot AS productName,quantity,sortOrder FROM order_items WHERE orderId=? ORDER BY sortOrder,id').all(id)};
  }
}
