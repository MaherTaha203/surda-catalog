/**
 * Fastify plugin — opens the SQLite database (auto-creating it + the schema) and
 * decorates the instance as `fastify.db`, available to every route/service.
 *
 * Wrapped in `fastify-plugin` so the decorator escapes plugin encapsulation and
 * is visible app-wide. Closes the connection on server shutdown.
 */
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { initDatabase } from '../database/index.ts';

declare module 'fastify' {
  interface FastifyInstance {
    db: DatabaseSync;
  }
}

const PREVIEW_DEMO_PRODUCTS = [
  {
    id: 'demo-product-001',
    name: 'سائل جلي تجريبي',
    description: 'صنف تجريبي لاختبار الطلبات',
    size: '1 لتر',
    cartonQuantity: 12,
    cartonPrice: 60,
    offerPrice: 0,
    offerQuantity: 0,
    bonusQuantity: 0,
    imageUrl: '',
    category: 'مواد التنظيف',
    isHidden: 0,
    sortOrder: 1,
  },
  {
    id: 'demo-product-002',
    name: 'منظف أرضيات تجريبي',
    description: 'صنف تجريبي لاختبار الطلبات',
    size: '1 لتر',
    cartonQuantity: 12,
    cartonPrice: 72,
    offerPrice: 0,
    offerQuantity: 0,
    bonusQuantity: 0,
    imageUrl: '',
    category: 'مواد التنظيف',
    isHidden: 0,
    sortOrder: 2,
  },
  {
    id: 'demo-product-003',
    name: 'مطهر متعدد الاستخدامات تجريبي',
    description: 'صنف تجريبي لاختبار الطلبات',
    size: '750 مل',
    cartonQuantity: 12,
    cartonPrice: 84,
    offerPrice: 0,
    offerQuantity: 0,
    bonusQuantity: 0,
    imageUrl: '',
    category: 'مواد التنظيف',
    isHidden: 0,
    sortOrder: 3,
  },
  {
    id: 'demo-product-004',
    name: 'إسفنج تنظيف تجريبي',
    description: 'صنف تجريبي لاختبار الطلبات',
    size: 'عبوة 10 قطع',
    cartonQuantity: 24,
    cartonPrice: 48,
    offerPrice: 0,
    offerQuantity: 0,
    bonusQuantity: 0,
    imageUrl: '',
    category: 'أدوات التنظيف',
    isHidden: 0,
    sortOrder: 4,
  },
  {
    id: 'demo-product-005',
    name: 'فرشاة تنظيف تجريبية',
    description: 'صنف تجريبي لاختبار الطلبات',
    size: 'قطعة واحدة',
    cartonQuantity: 24,
    cartonPrice: 36,
    offerPrice: 0,
    offerQuantity: 0,
    bonusQuantity: 0,
    imageUrl: '',
    category: 'أدوات التنظيف',
    isHidden: 0,
    sortOrder: 5,
  },
] as const;

/**
 * Demo catalog data is permitted only on the explicitly named preview service.
 * Never seed production, and never mix demo products into a non-empty catalog.
 */
function seedPreviewDemoProducts(db: DatabaseSync): number {
  if (process.env.RAILWAY_SERVICE_NAME !== 'surda-catalog-preview') return 0;

  const row = db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number };
  if (row.n !== 0) return 0;

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO products
      (id, name, description, size, cartonQuantity, cartonPrice,
       offerPrice, offerQuantity, bonusQuantity, imageUrl,
       category, isHidden, sortOrder, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    for (const product of PREVIEW_DEMO_PRODUCTS) {
      insert.run(
        product.id,
        product.name,
        product.description,
        product.size,
        product.cartonQuantity,
        product.cartonPrice,
        product.offerPrice,
        product.offerQuantity,
        product.bonusQuantity,
        product.imageUrl,
        product.category,
        product.isHidden,
        product.sortOrder,
        now,
        now,
      );
    }
    db.exec('COMMIT');
    return PREVIEW_DEMO_PRODUCTS.length;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

const databasePlugin: FastifyPluginAsync = async (fastify) => {
  const { db, dbPath, created } = initDatabase();
  const demoProductsAdded = seedPreviewDemoProducts(db);

  fastify.log.info(
    `SQLite ready at ${dbPath}${created ? ' (created new catalog.db)' : ''}`,
  );
  if (demoProductsAdded > 0) {
    fastify.log.info({ count: demoProductsAdded }, 'Seeded preview-only demo products');
  }

  fastify.decorate('db', db);

  fastify.addHook('onClose', async () => {
    db.close();
  });
};

export default fp(databasePlugin, { name: 'database' });
