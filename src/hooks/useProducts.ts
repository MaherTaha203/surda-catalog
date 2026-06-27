import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Product, ProductCategory } from '@/types/product';
import { saveProductsToCache, getCachedProducts } from '@/lib/offline-db';

const PRODUCTS_KEY = ['products'];

// Data source: the Fastify API (was Blink). The API's GET /products returns the
// same Product[] JSON Blink returned (ordered by sortOrder asc), so the rest of
// this hook — search, categories, counts, offline cache — is unchanged.
// Override the API origin with VITE_API_URL (default: local server on :4000).
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

async function fetchProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/products`);
    if (!res.ok) throw new Error(`API responded ${res.status}`);
    const items = (await res.json()) as Product[];
    const products = items || [];
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

  // Try cache first on mount
  useEffect(() => {
    getCachedProducts().then((cached) => {
      if (cached.length > 0 && products.length === 0) {
        queryClient.setQueryData(PRODUCTS_KEY, cached);
      }
    });
  }, []);

  const visibleProducts = products.filter((p) => Number(p.isHidden) === 0);

  const filteredProducts = visibleProducts.filter((p) => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    if (!matchesCategory) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.size.toLowerCase().includes(q)
    );
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
  }, [queryClient]);

  const counts = {
    all: visibleProducts.length,
    'مواد التنظيف': visibleProducts.filter((p) => p.category === 'مواد التنظيف').length,
    'أدوات التنظيف': visibleProducts.filter((p) => p.category === 'أدوات التنظيف').length,
  };

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
