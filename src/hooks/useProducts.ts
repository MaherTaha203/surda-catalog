import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Product, ProductCategory } from '@/types/product';
import { readProductsSnapshot, writeProductsSnapshot } from '@/lib/offline-db';
import { listProducts } from '@/api/products';

export const PRODUCTS_KEY = ['products'];

// Data source: the Fastify API (was Blink), via the shared products API client.
// The API returns the same Product[] (sortOrder asc), so the rest of this hook —
// search, categories, counts — is unchanged.
// Exported so the product detail page can share the same query (key + fetcher)
// when computing previous/next products for the image viewer.
export async function fetchProducts(): Promise<Product[]> {
  try {
    const products = await listProducts();
    // Write-through: keep the local snapshot fresh for the next cold start.
    writeProductsSnapshot(products);
    return products;
  } catch {
    // Network/API unavailable → serve the last local snapshot (offline).
    return readProductsSnapshot();
  }
}

/**
 * The local snapshot used to seed react-query's `initialData`. Returning
 * `undefined` (not `[]`) on a first-ever run keeps the query in its loading
 * state so the catalog shows skeletons instead of a false "no products" screen.
 */
export function productsInitialData(): Product[] | undefined {
  const snapshot = readProductsSnapshot();
  return snapshot.length > 0 ? snapshot : undefined;
}

export function useProducts() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all');
  const queryClient = useQueryClient();

  const { data: products = [], isLoading, error } = useQuery({
    queryKey: PRODUCTS_KEY,
    queryFn: fetchProducts,
    // LOCAL-FIRST: paint the last local snapshot on the very first frame, then
    // revalidate in the background. The network never blocks the catalog.
    // `initialData` has no timestamp, so react-query treats it as stale and
    // kicks off exactly one background refresh.
    initialData: productsInitialData,
    staleTime: 30_000,
  });

  // Visibility filter + per-category counts depend only on `products` — memoize
  // so typing in the search box doesn't recompute them on every keystroke.
  const visibleProducts = useMemo(
    () => products.filter((p) => Number(p.isHidden) === 0),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return visibleProducts.filter((p) => {
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.size.toLowerCase().includes(q)
      );
    });
  }, [visibleProducts, searchQuery, selectedCategory]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
  }, [queryClient]);

  const counts = useMemo(
    () => ({
      all: visibleProducts.length,
      'مواد التنظيف': visibleProducts.filter((p) => p.category === 'مواد التنظيف').length,
      'أدوات التنظيف': visibleProducts.filter((p) => p.category === 'أدوات التنظيف').length,
    }),
    [visibleProducts],
  );

  return {
    products: filteredProducts,
    allProducts: products,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    counts,
    refresh,
  };
}
