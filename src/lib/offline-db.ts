import type { Product } from '@/types/product';

const DB_NAME = 'sarda-catalog';
const DB_VERSION = 1;
const STORE_NAME = 'products';

// One shared connection per page — opening a new IDBDatabase on every read
// leaks connections (they are never closed) and adds open-latency to each call.
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => {
      dbPromise = null; // allow a retry on the next call
      reject(request.error);
    };
    request.onsuccess = () => {
      const db = request.result;
      // If the browser closes the connection (storage pressure, another tab
      // upgrading), drop the memo so the next call reopens cleanly.
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('sortOrder', 'sortOrder', { unique: false });
      }
    };
  });
  return dbPromise;
}

export async function saveProductsToCache(products: Product[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    for (const p of products) {
      store.put(p);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // IndexedDB not available (e.g., SSR)
  }
}

export async function getCachedProducts(): Promise<Product[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      // getAll() returns rows in key (id) order — restore the admin's catalog
      // order so the offline catalog matches the online one.
      request.onsuccess = () =>
        resolve((request.result || []).sort((a, b) => a.sortOrder - b.sortOrder));
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}
