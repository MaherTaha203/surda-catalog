/**
 * Per-device catalog display preferences — sales representatives (and the
 * admin, on their own device) tune how the catalog LOOKS without ever touching
 * the database: view order, grid density, background theme, font size, and a
 * personal show/hide-prices choice (effective only while the administrator
 * keeps prices globally available).
 *
 * Stored in localStorage; applied instantly through React context. The
 * canonical product order (sortOrder) is owned exclusively by the admin panel.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { CatalogSettings } from '@/api/settings';

export type GridDensity = 'small' | 'medium' | 'standard' | 'comfortable' | 'large';
export type FontScale = 'small' | 'standard' | 'large';
export type CatalogTheme = 'pure-white' | 'warm-white' | 'light-gray' | 'night';

export interface DisplayPrefs {
  density: GridDensity;
  fontScale: FontScale;
  theme: CatalogTheme;
  showPrices: boolean;
}

export const DISPLAY_PREFS_DEFAULTS: DisplayPrefs = {
  density: 'standard',
  fontScale: 'standard',
  theme: 'warm-white',
  showPrices: true,
};

const STORAGE_KEY = 'sarda_display_prefs';

/**
 * The one price-visibility rule, shared by every catalog surface:
 * prices must be globally available, and the device choice counts only while
 * the administrator allows representatives to toggle it.
 */
export function effectiveShowPrices(settings: CatalogSettings, prefs: DisplayPrefs): boolean {
  if (!settings.showPrices) return false;
  return settings.allowRepPriceToggle ? prefs.showPrices : true;
}

/* ── Option catalogs (labels are what both settings pages render) ─────────── */

export const DENSITY_OPTIONS: { value: GridDensity; label: string }[] = [
  { value: 'small', label: 'قليل' },
  { value: 'medium', label: 'متوسط' },
  { value: 'standard', label: 'قياسي' },
  { value: 'comfortable', label: 'مريح' },
  { value: 'large', label: 'كثيف' },
];

export const FONT_SCALE_OPTIONS: { value: FontScale; label: string }[] = [
  { value: 'small', label: 'صغير' },
  { value: 'standard', label: 'قياسي' },
  { value: 'large', label: 'كبير' },
];

export const THEME_OPTIONS: { value: CatalogTheme; label: string; swatch: string }[] = [
  { value: 'pure-white', label: 'أبيض', swatch: 'hsl(0 0% 100%)' },
  { value: 'warm-white', label: 'عاجي', swatch: 'hsl(40 20% 97%)' },
  { value: 'light-gray', label: 'رمادي فاتح', swatch: 'hsl(220 12% 93%)' },
  // Comfortable night: a soft warm slate (~20% lightness), never pure black.
  { value: 'night', label: 'ليلي', swatch: 'hsl(220 16% 20%)' },
];

/** hsl triplets matching index.css `--background` (warm-white is the stock look). */
const THEME_BACKGROUND: Record<CatalogTheme, string> = {
  'pure-white': '0 0% 100%',
  'warm-white': '40 20% 97%',
  'light-gray': '220 12% 93%',
  night: '220 16% 20%',
};

/** The night theme is the only dark option; it flips the full token set (index.css). */
export const DARK_THEMES: ReadonlySet<CatalogTheme> = new Set<CatalogTheme>(['night']);

/**
 * Grid classes per density — full literals so Tailwind's scanner sees them.
 * Columns: base / ≥640px / ≥1024px / ≥1280px.
 */
export const DENSITY_GRID: Record<GridDensity, string> = {
  small: 'grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-4',
  medium: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4',
  standard: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4',
  comfortable: 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3',
  large: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3',
};

/**
 * Font-size classes for exactly the text the spec names: product name,
 * description, price, offer information, and category labels. Nothing else.
 */
export const FONT_CLASSES: Record<
  FontScale,
  {
    cardName: string;
    cardDesc: string;
    cardPrice: string;
    cardOffer: string;
    cardBadge: string;
    categoryChip: string;
    detailName: string;
    detailDesc: string;
    detailPrice: string;
    detailOffer: string;
    detailBadge: string;
  }
> = {
  small: {
    cardName: 'text-sm',
    cardDesc: 'text-[11px]',
    cardPrice: 'text-base',
    cardOffer: 'text-[11px]',
    cardBadge: 'text-[9px]',
    categoryChip: 'text-xs',
    detailName: 'text-xl',
    detailDesc: 'text-sm',
    detailPrice: 'text-lg',
    detailOffer: 'text-[9px]',
    detailBadge: 'text-[11px]',
  },
  standard: {
    cardName: 'text-base',
    cardDesc: 'text-xs',
    cardPrice: 'text-lg',
    cardOffer: 'text-xs',
    cardBadge: 'text-[10px]',
    categoryChip: 'text-sm',
    detailName: 'text-2xl',
    detailDesc: 'text-base',
    detailPrice: 'text-xl',
    detailOffer: 'text-[10px]',
    detailBadge: 'text-xs',
  },
  large: {
    cardName: 'text-lg',
    cardDesc: 'text-sm',
    cardPrice: 'text-xl',
    cardOffer: 'text-sm',
    cardBadge: 'text-xs',
    categoryChip: 'text-base',
    detailName: 'text-3xl',
    detailDesc: 'text-lg',
    detailPrice: 'text-2xl',
    detailOffer: 'text-xs',
    detailBadge: 'text-sm',
  },
};

/* ── Persistence + context ────────────────────────────────────────────────── */

function loadPrefs(): DisplayPrefs {
  if (typeof window === 'undefined') return DISPLAY_PREFS_DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DISPLAY_PREFS_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<DisplayPrefs>;
    return {
      density: DENSITY_OPTIONS.some((o) => o.value === parsed.density)
        ? (parsed.density as GridDensity)
        : DISPLAY_PREFS_DEFAULTS.density,
      fontScale: FONT_SCALE_OPTIONS.some((o) => o.value === parsed.fontScale)
        ? (parsed.fontScale as FontScale)
        : DISPLAY_PREFS_DEFAULTS.fontScale,
      theme: THEME_OPTIONS.some((o) => o.value === parsed.theme)
        ? (parsed.theme as CatalogTheme)
        : DISPLAY_PREFS_DEFAULTS.theme,
      showPrices:
        typeof parsed.showPrices === 'boolean'
          ? parsed.showPrices
          : DISPLAY_PREFS_DEFAULTS.showPrices,
    };
  } catch {
    return DISPLAY_PREFS_DEFAULTS;
  }
}

interface DisplayPrefsContextValue {
  prefs: DisplayPrefs;
  setPref: <K extends keyof DisplayPrefs>(key: K, value: DisplayPrefs[K]) => void;
}

const DisplayPrefsContext = createContext<DisplayPrefsContextValue>({
  prefs: DISPLAY_PREFS_DEFAULTS,
  setPref: () => {},
});

export function DisplayPrefsProvider({ children }: { children: ReactNode }) {
  // SSR and the client's first render both use defaults; the stored prefs are
  // applied after mount to avoid a hydration mismatch.
  const [prefs, setPrefs] = useState<DisplayPrefs>(DISPLAY_PREFS_DEFAULTS);
  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const setPref = useCallback(
    <K extends keyof DisplayPrefs>(key: K, value: DisplayPrefs[K]) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* storage may be unavailable (private mode) — prefs stay in memory */
        }
        return next;
      });
    },
    [],
  );

  // Apply the background theme app-wide, instantly. Light themes only swap the
  // background; the night theme also toggles `theme-night`, which flips the full
  // palette (foreground/card/border/…) defined in index.css so text stays legible.
  useEffect(() => {
    document.documentElement.style.setProperty('--background', THEME_BACKGROUND[prefs.theme]);
    document.documentElement.classList.toggle('theme-night', DARK_THEMES.has(prefs.theme));
  }, [prefs.theme]);

  return (
    <DisplayPrefsContext.Provider value={{ prefs, setPref }}>
      {children}
    </DisplayPrefsContext.Provider>
  );
}

export function useDisplayPrefs(): DisplayPrefsContextValue {
  return useContext(DisplayPrefsContext);
}
