import { useQuery } from '@tanstack/react-query';
import {
  getCatalogSettings,
  readCachedCatalogSettings,
  CATALOG_SETTINGS_DEFAULTS,
  type CatalogSettings,
} from '@/api/settings';
import { useIsClient } from '@/hooks/useIsClient';

export const CATALOG_SETTINGS_KEY = ['catalog-settings'];

/**
 * Admin-owned catalog-wide settings (prices availability, default product
 * image). While the fetch is in flight — and when the API is unreachable —
 * the device's last-synced copy applies, so a fresh page load respects the
 * admin's choices immediately and an offline catalog keeps working.
 *
 * SSR and the client's FIRST render both use the defaults (localStorage is
 * client-only), switching to the cached copy right after mount — same
 * hydration-safety pattern as the rest of the app.
 */
export function useCatalogSettings(): CatalogSettings {
  const isClient = useIsClient();
  const { data } = useQuery({
    queryKey: CATALOG_SETTINGS_KEY,
    queryFn: getCatalogSettings,
    staleTime: 30_000,
    retry: 1,
    enabled: isClient,
    placeholderData: isClient ? readCachedCatalogSettings : () => CATALOG_SETTINGS_DEFAULTS,
  });
  if (!isClient) return CATALOG_SETTINGS_DEFAULTS;
  return data ?? readCachedCatalogSettings();
}
