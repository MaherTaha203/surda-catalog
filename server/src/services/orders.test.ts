import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initDatabase } from '../database/index.ts';
import { OrdersService } from './orders.ts';

describe('OrdersService offline sync contract', () => {
  let dir: string;
  let service: OrdersService;
  let close: () => void;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sarda-orders-test-'));
    const { db } = initDatabase(join(dir, 'test.db'));
    service = new OrdersService(db);
    close = () => db.close();
    service.saveCustomer({ id: 'customer-1', name: 'زبون اختبار' });
  });
  afterEach(() => {
    close();
    rmSync(dir, { recursive: true, force: true });
  });
  const mutation = (overrides: { mutationId?: string; deviceId?: string; baseRevision?: number; order?: { id: string; customerId: string; customerName: string; status: 'draft'|'submitted'|'cancelled'; items: { id: string; productId: string; productName: string; quantity: number; sortOrder?: number }[] } } = {}) => ({
    mutationId: 'mutation-1', deviceId: 'device-1', baseRevision: 0,
    order: { id: 'order-1', customerId: 'customer-1', customerName: 'زبون اختبار', status: 'draft' as const,
      items: [{ id: 'item-1', productId: 'product-1', productName: 'صنف تاريخي', quantity: 2, sortOrder: 0 }] },
    ...overrides,
  });
  it('applies a new order once and keeps the product-name snapshot', () => {
    const first = service.applyMutation(mutation());
    assert.equal(first.status, 'applied');
    assert.equal(first.order?.orderNumber, 1);
    assert.equal(first.order?.items[0]?.productName, 'صنف تاريخي');
    const replay = service.applyMutation(mutation());
    assert.equal(replay.status, 'duplicate');
    assert.equal(replay.order?.id, 'order-1');
    assert.equal(service.listOrders().length, 1);
  });
  it('returns a conflict instead of silently overwriting a newer revision', () => {
    service.applyMutation(mutation());
    const conflicting = service.applyMutation(mutation({ mutationId: 'mutation-2', deviceId: 'device-2', baseRevision: 0 }));
    assert.equal(conflicting.status, 'conflict');
    assert.equal(conflicting.current?.revision, 1);
    assert.equal(service.getOrder('order-1')?.items[0]?.quantity, 2);
  });
  it('rejects non-positive quantities without creating an order', () => {
    assert.throws(() => service.applyMutation(mutation({
      order: { ...mutation().order, items: [{ id: 'item-1', productId: 'product-1', productName: 'صنف', quantity: 0 }] },
    })), /INVALID_ORDER_ITEMS/);
    assert.equal(service.listOrders().length, 0);
  });
  it('assigns unique sequential order numbers for different clients', () => {
    service.applyMutation(mutation());
    service.applyMutation(mutation({ mutationId: 'mutation-2', order: { ...mutation().order, id: 'order-2' } }));
    assert.deepEqual(service.listOrders().map(o => o.orderNumber).sort(), [1, 2]);
  });
});
