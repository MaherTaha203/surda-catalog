import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Product, ProductCategory } from '@/types/product';
import { saveProductsToCache, getCachedProducts } from '@/lib/offline-db';
import { listProducts } from '@/api/products';

const PRODUCTS_KEY = ['products'];

// Data source: the Fastify API (was Blink), via the shared products API client.
// The API returns the same Product[] (sortOrder asc), so the rest of this hook —
// search, categories, counts, offline cache — is unchanged.
async function fetchProducts(): Promise<Product[]> {
  try {
    const products = await listProducts();
    // Cache for offline
    saveProductsToCache(products).catch(() => {});
    return products;
  } catch {
    // API unavailable → show the existing offline cache
    return getCachedProducts();
  }
}

export function useProducts() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all');
  const queryClient = useQueryClient();

  const { data: products = [], isLoading, error } = useQuery({
    queryKey: PRODUCTS_KEY,
    queryFn: fetchProducts,
    staleTime: 30_000,
  });

  // Seed from the offline cache on mount so products appear instantly — but only
  // when the query has no data yet. Check the LIVE query cache (not a stale render
  // closure), otherwise a late-resolving IndexedDB read could clobber fresh data
  // the network already returned (e.g. showing an old image after a replace).
  useEffect(() => {
    getCachedProducts().then((cached) => {
      if (cached.length === 0) return;
      const current = queryClient.getQueryData<Product[]>(PRODUCTS_KEY);
      if (!current || current.length === 0) {
        queryClient.setQueryData(PRODUCTS_KEY, cached);
      }
    });
  }, [queryClient]);

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
