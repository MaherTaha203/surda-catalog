import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import {
  useDisplayPrefs,
  DENSITY_OPTIONS,
  FONT_SCALE_OPTIONS,
  THEME_OPTIONS,
} from '@/lib/display-prefs';
import { useCatalogSettings } from '@/hooks/useCatalogSettings';
import { OptionGroup, ToggleSwitch } from '@/components/PrefControls';

/**
 * Display options for sales representatives — open to everyone, no PIN.
 * Device-local view preferences only; nothing here can touch the database,
 * the admin's product order, images, or the PIN.
 */
export const Route = createFileRoute('/preferences')({
  head: () => ({ meta: [{ title: 'خيارات العرض — سردا' }] }),
  component: PreferencesPage,
});

function PreferencesPage() {
  const { prefs, setPref } = useDisplayPrefs();
  const settings = useCatalogSettings();
  // Representatives see the price option only while prices are globally
  // available AND the administrator allows them to choose.
  const canTogglePrices = settings.showPrices && settings.allowRepPriceToggle;

  return (
    <div className="min-h-dvh bg-background" dir="rtl">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            to="/catalog"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowRight size={18} aria-hidden /> الكتالوج
          </Link>
          <h1 className="text-lg font-bold text-foreground">خيارات العرض</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <section className="p-5 rounded-2xl bg-card border border-border space-y-6">
          {canTogglePrices && (
            <ToggleSwitch
              label="إظهار الأسعار"
              description="إخفاء الأسعار على هذا الجهاز عند عرض الكتالوج أمام العملاء."
              checked={prefs.showPrices}
              onChange={(v) => setPref('showPrices', v)}
            />
          )}

          <OptionGroup
            label="عدد المنتجات في الصفحة"
            description="كثافة عرض البطاقات في الشبكة."
            options={DENSITY_OPTIONS}
            value={prefs.density}
            onChange={(v) => setPref('density', v)}
          />

          <OptionGroup
            label="خلفية الكتالوج"
            options={THEME_OPTIONS}
            value={prefs.theme}
            onChange={(v) => setPref('theme', v)}
          />

          <OptionGroup
            label="حجم الخط"
            description="يؤثر على اسم المنتج والوصف والسعر ومعلومات العرض وتسميات الفئات."
            options={FONT_SCALE_OPTIONS}
            value={prefs.fontScale}
            onChange={(v) => setPref('fontScale', v)}
          />
        </section>

        <p className="text-xs text-muted-foreground text-center mt-4">
          خيارات شخصية تُحفظ على هذا الجهاز فقط، ولا تؤثر على بقية الأجهزة.
        </p>
      </main>
    </div>
  );
}
