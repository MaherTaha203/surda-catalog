/**
 * Products API client — typed functions over the Fastify endpoints, used by the
 * catalog hook, the admin panel, and the product detail page (replacing Blink).
 *
 * Read responses have their image URLs resolved to absolute (for display);
 * writes strip them back to the canonical relative form before sending.
 */
import type { Product } from '@/types/product';
import {
  apiRequest,
  apiUrl,
  ApiError,
  resolveImageUrl,
  toStoredImageUrl,
} from './client';

const JSON_HEADERS = { 'content-type': 'application/json' };

/** Map a product from the API into display form (absolute image URL). */
function forDisplay(p: Product): Product {
  return { ...p, imageUrl: resolveImageUrl(p.imageUrl) };
}

/** Map outgoing product data so the stored image URL stays relative. */
function forStorage<T extends { imageUrl?: string }>(data: T): T {
  if (data.imageUrl === undefined) return data;
  return { ...data, imageUrl: toStoredImageUrl(data.imageUrl) };
}

export async function listProducts(): Promise<Product[]> {
  const items = await apiRequest<Product[]>('/products');
  return (items ?? []).map(forDisplay);
}

export async function getProduct(id: string): Promise<Product | null> {
  try {
    return forDisplay(await apiRequest<Product>(`/products/${encodeURIComponent(id)}`));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function createProduct(data: Record<string, unknown>): Promise<Product> {
  const created = await apiRequest<Product>('/products', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(forStorage(data as { imageUrl?: string })),
  });
  return forDisplay(created);
}

export async function updateProduct(
  id: string,
  data: Record<string, unknown>,
): Promise<Product> {
  const updated = await apiRequest<Product>(`/products/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(forStorage(data as { imageUrl?: string })),
  });
  return forDisplay(updated);
}

export async function deleteProduct(id: string): Promise<void> {
  await apiRequest<void>(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function setProductVisibility(id: string, isHidden: number): Promise<Product> {
  const updated = await apiRequest<Product>(
    `/products/${encodeURIComponent(id)}/visibility`,
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ isHidden }) },
  );
  return forDisplay(updated);
}

export async function setProductOrder(id: string, sortOrder: number): Promise<Product> {
  const updated = await apiRequest<Product>(
    `/products/${encodeURIComponent(id)}/order`,
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ sortOrder }) },
  );
  return forDisplay(updated);
}

/**
 * Upload a product image. Returns the stored (relative) URL. Pass the current
 * image URL as `oldImageUrl` to delete it server-side when replacing.
 */
export async function uploadProductImage(file: File, oldImageUrl?: string): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const q = oldImageUrl
    ? `?oldImageUrl=${encodeURIComponent(toStoredImageUrl(oldImageUrl))}`
    : '';
  const res = await fetch(apiUrl(`/upload${q}`), { method: 'POST', body: form });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}
