import { useRef, useState, useEffect } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { ArrowRight, ImagePlus, KeyRound, Trash2, Check, Coins, ImageOff, ListOrdered, Building2, Save } from 'lucide-react';
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
import { ToggleSwitch } from '@/components/PrefControls';
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

/** Shared image picker row (logo / default product image) — one visual style. */
function ImagePickerRow({
  preview,
  previewAlt,
  emptyIcon,
  uploadLabel,
  replaceLabel,
  removeLabel,
  busy,
  onPick,
  onRemove,
  inputLabel,
  previewFit = 'cover',
}: {
  preview: string;
  previewAlt: string;
  emptyIcon: React.ReactNode;
  uploadLabel: string;
  replaceLabel: string;
  removeLabel: string;
  busy?: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
  inputLabel: string;
  previewFit?: 'cover' | 'contain';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-4">
      {preview ? (
        <img
          src={preview}
          alt={previewAlt}
          className={`h-16 w-16 rounded-xl border border-border ${previewFit === 'cover' ? 'object-cover' : 'object-contain bg-muted'}`}
        />
      ) : (
        <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
          {emptyIcon}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {busy ? 'جاري الرفع...' : preview ? replaceLabel : uploadLabel}
        </button>
        {preview && !busy && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 size={14} aria-hidden /> {removeLabel}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        aria-label={inputLabel}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onPick(file);
        }}
      />
    </div>
  );
}

function SettingsPage() {
  const navigate = useNavigate();
  const isClient = useIsClient();
  const queryClient = useQueryClient();
  const unlocked = isClient && isPinUnlocked() && isAdminUnlocked();

  // `replace` keeps the guarded page out of history — Back must not return to it.
  useEffect(() => {
    if (isClient && !unlocked) navigate({ to: '/', replace: true });
  }, [unlocked, navigate, isClient]);

  const settings = useCatalogSettings();

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

  // Company Profile text fields (server settings) — edited locally, saved on demand.
  type CompanyFields = Pick<
    CatalogSettings,
    'companyName' | 'companyTagline' | 'companyPhone' | 'companyWhatsapp' | 'companyEmail' | 'companyWebsite' | 'companyAddress'
  >;
  const [company, setCompany] = useState<CompanyFields>({
    companyName: '',
    companyTagline: '',
    companyPhone: '',
    companyWhatsapp: '',
    companyEmail: '',
    companyWebsite: '',
    companyAddress: '',
  });
  // Seed the form from settings once they load / change on the server.
  useEffect(() => {
    setCompany({
      companyName: settings.companyName,
      companyTagline: settings.companyTagline,
      companyPhone: settings.companyPhone,
      companyWhatsapp: settings.companyWhatsapp,
      companyEmail: settings.companyEmail,
      companyWebsite: settings.companyWebsite,
      companyAddress: settings.companyAddress,
    });
  }, [
    settings.companyName,
    settings.companyTagline,
    settings.companyPhone,
    settings.companyWhatsapp,
    settings.companyEmail,
    settings.companyWebsite,
    settings.companyAddress,
  ]);
  const companyDirty =
    company.companyName !== settings.companyName ||
    company.companyTagline !== settings.companyTagline ||
    company.companyPhone !== settings.companyPhone ||
    company.companyWhatsapp !== settings.companyWhatsapp ||
    company.companyEmail !== settings.companyEmail ||
    company.companyWebsite !== settings.companyWebsite ||
    company.companyAddress !== settings.companyAddress;

  // Default product image (server-side)
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

  const handleSaveCompany = async () => {
    try {
      await settingsMutation.mutateAsync({
        companyName: company.companyName.trim() || 'شركة سردا',
        companyTagline: company.companyTagline.trim(),
        companyPhone: company.companyPhone.trim(),
        companyWhatsapp: company.companyWhatsapp.trim(),
        companyEmail: company.companyEmail.trim(),
        companyWebsite: company.companyWebsite.trim(),
        companyAddress: company.companyAddress.trim(),
      });
      toast.success('تم حفظ معلومات الشركة');
    } catch {
      /* error toast already shown by the mutation */
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

  const companyField = (
    id: string,
    label: string,
    key: keyof CompanyFields,
    opts: { type?: string; dir?: 'rtl' | 'ltr'; placeholder?: string; inputMode?: 'text' | 'tel' | 'email' | 'url' } = {},
  ) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type={opts.type ?? 'text'}
        dir={opts.dir ?? 'rtl'}
        inputMode={opts.inputMode}
        value={company[key]}
        placeholder={opts.placeholder}
        onChange={(e) => setCompany((c) => ({ ...c, [key]: e.target.value }))}
        className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring"
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
        {/* 1 — Company Profile (single source of company identity) */}
        <SectionCard
          icon={<Building2 size={18} className="text-primary" aria-hidden />}
          title="معلومات الشركة"
          description="مصدر واحد لهوية الشركة — يُستخدم في رأس الكتالوج والعروض التسويقية وملفات PDF. الشعار يُحفظ على هذا الجهاز، وبقية المعلومات تُحفظ على كل الأجهزة."
        >
          <div className="space-y-5">
            <div>
              <span className="block text-sm font-medium text-foreground mb-2">الشعار</span>
              <ImagePickerRow
                preview={logo}
                previewAlt="شعار الشركة الحالي"
                emptyIcon={<ImagePlus size={22} strokeWidth={1.5} aria-hidden />}
                uploadLabel="رفع شعار"
                replaceLabel="استبدال الشعار"
                removeLabel="إزالة الشعار"
                inputLabel="اختيار شعار الشركة"
                onPick={handleLogoPick}
                onRemove={() => setConfirmRemoveLogo(true)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {companyField('company-name', 'اسم الشركة', 'companyName', { placeholder: 'شركة سردا' })}
              {companyField('company-tagline', 'الوصف / الشعار النصي', 'companyTagline', { placeholder: 'للتجارة والصناعة' })}
              {companyField('company-phone', 'الهاتف', 'companyPhone', { dir: 'ltr', inputMode: 'tel', placeholder: '+970...' })}
              {companyField('company-whatsapp', 'واتساب', 'companyWhatsapp', { dir: 'ltr', inputMode: 'tel', placeholder: '+970...' })}
              {companyField('company-email', 'البريد الإلكتروني', 'companyEmail', { type: 'email', dir: 'ltr', inputMode: 'email', placeholder: 'info@example.com' })}
              {companyField('company-website', 'الموقع الإلكتروني', 'companyWebsite', { dir: 'ltr', inputMode: 'url', placeholder: 'www.example.com' })}
              <div className="sm:col-span-2">
                {companyField('company-address', 'العنوان', 'companyAddress', { placeholder: 'المدينة، الشارع...' })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveCompany}
              disabled={!companyDirty || settingsMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Save size={16} aria-hidden /> حفظ معلومات الشركة
            </button>
          </div>
        </SectionCard>

        {/* 2 — Default product image */}
        <SectionCard
          icon={<ImageOff size={18} className="text-primary" aria-hidden />}
          title="الصورة الافتراضية للمنتجات"
          description="تُعرض تلقائياً لأي منتج بلا صورة، على كل الأجهزة."
        >
          <ImagePickerRow
            preview={settings.defaultProductImageUrl}
            previewAlt="الصورة الافتراضية الحالية"
            emptyIcon={<ImageOff size={22} strokeWidth={1.5} aria-hidden />}
            uploadLabel="رفع صورة"
            replaceLabel="استبدال الصورة"
            removeLabel="إزالة الصورة"
            inputLabel="اختيار الصورة الافتراضية"
            busy={uploadingDefault}
            previewFit="contain"
            onPick={handleDefaultImagePick}
            onRemove={() => setConfirmRemoveDefault(true)}
          />
        </SectionCard>

        {/* 3 — Product ordering (managed in the admin panel, never here) */}
        <SectionCard
          icon={<ListOrdered size={18} className="text-primary" aria-hidden />}
          title="ترتيب المنتجات"
          description="الترتيب الأصلي للكتالوج يملكه المدير وحده، ولا يستطيع المندوبون تغييره."
        >
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <ListOrdered size={16} aria-hidden /> إدارة ترتيب المنتجات
          </Link>
        </SectionCard>

        {/* 4 — Price permissions */}
        <SectionCard
          icon={<Coins size={18} className="text-primary" aria-hidden />}
          title="صلاحيات الأسعار"
          description="إعدادات عامة تسري على كل الأجهزة فوراً."
        >
          <div className="space-y-5">
            <ToggleSwitch
              label="إتاحة الأسعار في الكتالوج"
              description="عند الإيقاف تختفي الأسعار لدى الجميع."
              checked={settings.showPrices}
              disabled={settingsMutation.isPending}
              onChange={(v) => settingsMutation.mutate({ showPrices: v })}
            />
            <ToggleSwitch
              label="السماح للمندوبين بإخفاء الأسعار"
              description="عند الإيقاف يختفي خيار الأسعار من صفحة خيارات العرض، وتظهر الأسعار دائماً."
              checked={settings.allowRepPriceToggle}
              disabled={settingsMutation.isPending || !settings.showPrices}
              onChange={(v) => settingsMutation.mutate({ allowRepPriceToggle: v })}
            />
          </div>
        </SectionCard>

        {/* 5 — Admin PIN */}
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
