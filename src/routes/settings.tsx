import { useRef, useState, useEffect } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { ArrowRight, ImagePlus, KeyRound, Trash2, Check } from 'lucide-react';
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

function SettingsPage() {
  const navigate = useNavigate();
  const isClient = useIsClient();
  const unlocked = isClient && isPinUnlocked() && isAdminUnlocked();

  useEffect(() => {
    if (isClient && !unlocked) navigate({ to: '/' });
  }, [unlocked, navigate, isClient]);

  const [logo, setLogo] = useState('');
  useEffect(() => {
    if (isClient) setLogo(getCompanyLogo());
  }, [isClient]);
  const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleRemoveLogo = () => {
    setCompanyLogo('');
    setLogo('');
    setConfirmRemoveLogo(false);
    toast.success('تمت إزالة الشعار');
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
        {/* Company logo */}
        <section className="p-5 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-1">
            <ImagePlus size={18} className="text-primary" aria-hidden />
            <h2 className="text-base font-bold text-foreground">شعار الشركة</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            يظهر الشعار في رأس صفحة الكتالوج. يُحفظ على هذا الجهاز.
          </p>
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
                onClick={() => fileInputRef.current?.click()}
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
              ref={fileInputRef}
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
        </section>

        {/* Admin PIN */}
        <section className="p-5 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound size={18} className="text-primary" aria-hidden />
            <h2 className="text-base font-bold text-foreground">رمز المدير</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            رمز من 4 أرقام للدخول إلى لوحة التحكم. يُحفظ على هذا الجهاز.
          </p>
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
        </section>
      </main>

      <ConfirmDialog
        open={confirmRemoveLogo}
        title="إزالة الشعار"
        description="سيعود رأس الكتالوج إلى الشعار الافتراضي."
        confirmLabel="إزالة"
        destructive
        onConfirm={handleRemoveLogo}
        onCancel={() => setConfirmRemoveLogo(false)}
      />
    </div>
  );
}
