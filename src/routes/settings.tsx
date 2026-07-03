import { useRef, useState, useEffect } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { ArrowRight, ImagePlus, KeyRound, Trash2, Check, Coins, ImageOff, SlidersHorizontal } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@blinkdotnew/ui';
import {
  getAdminPin,
  setAdminPin,
  getCompanyLogo,
  setCompanyLogo,
  isAdminUnlocked,
  isPinUnlocked,
} from '@/lib/storage';
import { useIsClient } from '@/hooks/useIsClient';
import { useCatalogSettings, CATALOG_SETTINGS_KEY } from '@/hooks/useCatalogSettings';
import { updateCatalogSettings, type CatalogSettings } from '@/api/settings';
import { uploadProductImage } from '@/api/products';
import { compressProductImage, ImageValidationError } from '@/lib/image-compression';
import {
  useDisplayPrefs,
  DENSITY_OPTIONS,
  FONT_SCALE_OPTIONS,
  THEME_OPTIONS,
  VIEW_ORDER_OPTIONS,
} from '@/lib/display-prefs';
import { OptionGroup, ToggleSwitch } from '@/components/PrefControls';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export const Route = createFileRoute('/settings')({
  head: () => ({ meta: [{ title: 'إعدادات الكتالوج — سردا' }] }),
  component: SettingsPage,
});

/**
 * Downscale the picked logo to a small square-ish bitmap and inline it as a
 * data URL — the logo (like the PINs) lives in localStorage on this device,
 * so it must stay tiny and must not depend on the uploads directory (whose
 * garbage collector only knows about product images).
 */
async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('الملف المحدد ليس صورة صالحة');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const MAX = 256;
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.85);
  } finally {
    bitmap.close();
  }
}

const pinInputClass =
  'w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring';

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="p-5 rounded-2xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h2 className="text-base font-bold text-foreground">{title}</h2>
      </div>
      {description && <p className="text-xs text-muted-foreground mb-4">{description}</p>}
      {children}
    </section>
  );
}

function SettingsPage() {
  const navigate = useNavigate();
  const isClient = useIsClient();
  const queryClient = useQueryClient();
  const unlocked = isClient && isPinUnlocked() && isAdminUnlocked();

  useEffect(() => {
    if (isClient && !unlocked) navigate({ to: '/' });
  }, [unlocked, navigate, isClient]);

  const settings = useCatalogSettings();
  const { prefs, setPref } = useDisplayPrefs();

  const settingsMutation = useMutation({
    mutationFn: (patch: Partial<CatalogSettings>) => updateCatalogSettings(patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(CATALOG_SETTINGS_KEY, updated);
    },
    onError: (e: Error) => toast.error(e.message || 'فشل حفظ الإعدادات'),
  });

  // Company logo (device-local)
  const [logo, setLogo] = useState('');
  useEffect(() => {
    if (isClient) setLogo(getCompanyLogo());
  }, [isClient]);
  const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Default product image (server-side)
  const defaultImgInputRef = useRef<HTMLInputElement>(null);
  const [confirmRemoveDefault, setConfirmRemoveDefault] = useState(false);
  const [uploadingDefault, setUploadingDefault] = useState(false);

  // Admin PIN
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  if (!unlocked) return null;

  const handleLogoPick = async (file: File) => {
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      setCompanyLogo(dataUrl);
      setLogo(dataUrl);
      toast.success('تم تحديث شعار الشركة');
    } catch (e) {
      toast.error((e as Error).message || 'تعذّر معالجة الصورة');
    }
  };

  const handleDefaultImagePick = async (file: File) => {
    setUploadingDefault(true);
    try {
      let toUpload = file;
      try {
        toUpload = await compressProductImage(file);
      } catch (e) {
        if (e instanceof ImageValidationError) {
          toast.error(e.message);
          return;
        }
        throw e;
      }
      // Old file is deleted server-side after the settings row updates.
      const url = await uploadProductImage(toUpload);
      await settingsMutation.mutateAsync({ defaultProductImageUrl: url });
      toast.success('تم تحديث الصورة الافتراضية');
    } catch (e) {
      toast.error((e as Error).message || 'فشل رفع الصورة');
    } finally {
      setUploadingDefault(false);
    }
  };

  const handleRemoveDefaultImage = async () => {
    setConfirmRemoveDefault(false);
    try {
      await settingsMutation.mutateAsync({ defaultProductImageUrl: '' });
      toast.success('تمت إزالة الصورة الافتراضية');
    } catch {
      /* error toast already shown by the mutation */
    }
  };

  const handleChangePin = () => {
    if (currentPin !== getAdminPin()) {
      toast.error('الرمز الحالي غير صحيح');
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      toast.error('الرمز الجديد يجب أن يتكون من 4 أرقام');
      return;
    }
    if (newPin !== confirmPin) {
      toast.error('تأكيد الرمز غير مطابق');
      return;
    }
    setAdminPin(newPin);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    toast.success('تم تغيير رمز المدير');
  };

  const pinField = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
  ) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className={pinInputClass}
        placeholder="••••"
      />
    </div>
  );

  return (
    <div className="min-h-dvh bg-background" dir="rtl">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            to="/admin"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowRight size={18} aria-hidden /> لوحة التحكم
          </Link>
          <h1 className="text-lg font-bold text-foreground">إعدادات الكتالوج</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Prices — global availability */}
        <SectionCard
          icon={<Coins size={18} className="text-primary" aria-hidden />}
          title="الأسعار"
          description="إعداد عام يسري على كل الأجهزة فوراً."
        >
          <ToggleSwitch
            label="إتاحة الأسعار في الكتالوج"
            description="عند الإيقاف تختفي الأسعار لدى الجميع، ولا يستطيع المندوبون إظهارها."
            checked={settings.showPrices}
            disabled={settingsMutation.isPending}
            onChange={(v) => settingsMutation.mutate({ showPrices: v })}
          />
        </SectionCard>

        {/* Default product image — global */}
        <SectionCard
          icon={<ImageOff size={18} className="text-primary" aria-hidden />}
          title="الصورة الافتراضية للمنتجات"
          description="تُعرض تلقائياً لأي منتج بلا صورة، على كل الأجهزة."
        >
          <div className="flex items-center gap-4">
            {settings.defaultProductImageUrl ? (
              <img
                src={settings.defaultProductImageUrl}
                alt="الصورة الافتراضية الحالية"
                className="h-16 w-16 rounded-xl object-contain bg-muted border border-border"
              />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                <ImageOff size={22} strokeWidth={1.5} aria-hidden />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={uploadingDefault}
                onClick={() => defaultImgInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {uploadingDefault
                  ? 'جاري الرفع...'
                  : settings.defaultProductImageUrl
                    ? 'استبدال الصورة'
                    : 'رفع صورة'}
              </button>
              {settings.defaultProductImageUrl && !uploadingDefault && (
                <button
                  type="button"
                  onClick={() => setConfirmRemoveDefault(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 size={14} aria-hidden /> إزالة الصورة
                </button>
              )}
            </div>
            <input
              ref={defaultImgInputRef}
              type="file"
              accept="image/*"
              aria-label="اختيار الصورة الافتراضية"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) handleDefaultImagePick(file);
              }}
            />
          </div>
        </SectionCard>

        {/* Device display options */}
        <SectionCard
          icon={<SlidersHorizontal size={18} className="text-primary" aria-hidden />}
          title="خيارات العرض"
          description="خيارات عرض تخص هذا الجهاز فقط. ترتيب المنتجات الأصلي يظل محفوظاً ولا يتغير."
        >
          <div className="space-y-6">
            <OptionGroup
              label="ترتيب العرض"
              description="طريقة عرض فقط — لا تغيّر الترتيب الأصلي المحفوظ."
              options={VIEW_ORDER_OPTIONS}
              value={prefs.viewOrder}
              onChange={(v) => setPref('viewOrder', v)}
            />
            <OptionGroup
              label="عدد المنتجات في الصفحة"
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
          </div>
        </SectionCard>

        {/* Company logo */}
        <SectionCard
          icon={<ImagePlus size={18} className="text-primary" aria-hidden />}
          title="شعار الشركة"
          description="يظهر الشعار في رأس صفحة الكتالوج. يُحفظ على هذا الجهاز."
        >
          <div className="flex items-center gap-4">
            {logo ? (
              <img src={logo} alt="شعار الشركة الحالي" className="h-16 w-16 rounded-xl object-cover border border-border" />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                <ImagePlus size={22} strokeWidth={1.5} aria-hidden />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                {logo ? 'استبدال الشعار' : 'رفع شعار'}
              </button>
              {logo && (
                <button
                  type="button"
                  onClick={() => setConfirmRemoveLogo(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 size={14} aria-hidden /> إزالة الشعار
                </button>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              aria-label="اختيار شعار الشركة"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) handleLogoPick(file);
              }}
            />
          </div>
        </SectionCard>

        {/* Admin PIN */}
        <SectionCard
          icon={<KeyRound size={18} className="text-primary" aria-hidden />}
          title="رمز المدير"
          description="رمز من 4 أرقام للدخول إلى لوحة التحكم. يُحفظ على هذا الجهاز."
        >
          <div className="space-y-3 max-w-xs">
            {pinField('pin-current', 'الرمز الحالي', currentPin, setCurrentPin)}
            {pinField('pin-new', 'الرمز الجديد', newPin, setNewPin)}
            {pinField('pin-confirm', 'تأكيد الرمز الجديد', confirmPin, setConfirmPin)}
            <button
              type="button"
              onClick={handleChangePin}
              disabled={!currentPin || !newPin || !confirmPin}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check size={16} aria-hidden /> حفظ الرمز الجديد
            </button>
          </div>
        </SectionCard>
      </main>

      <ConfirmDialog
        open={confirmRemoveLogo}
        title="إزالة الشعار"
        description="سيعود رأس الكتالوج إلى الشعار الافتراضي."
        confirmLabel="إزالة"
        destructive
        onConfirm={() => {
          setCompanyLogo('');
          setLogo('');
          setConfirmRemoveLogo(false);
          toast.success('تمت إزالة الشعار');
        }}
        onCancel={() => setConfirmRemoveLogo(false)}
      />

      <ConfirmDialog
        open={confirmRemoveDefault}
        title="إزالة الصورة الافتراضية"
        description="ستظهر المنتجات التي بلا صورة برمز بديل بدلاً من هذه الصورة."
        confirmLabel="إزالة"
        destructive
        onConfirm={handleRemoveDefaultImage}
        onCancel={() => setConfirmRemoveDefault(false)}
      />
    </div>
  );
}
