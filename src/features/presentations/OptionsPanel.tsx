/**
 * Presentation Builder — display options (rail).
 *
 * Compact toggle chips for product fields + header/footer chrome, and the
 * products-per-page selector (4/6/9/12). Price-related toggles are disabled and
 * forced off when the admin has globally hidden prices (brief price rules).
 */
import { PER_PAGE_OPTIONS, type PerPage, type PresentationOptions, type PresentationFields, type PresentationChrome } from './types';

interface Props {
  options: PresentationOptions;
  onChange: (patch: Partial<PresentationOptions>) => void;
  showPricesGlobal: boolean;
}

const FIELD_LABELS: { key: keyof PresentationFields; label: string; price?: boolean }[] = [
  { key: 'image', label: 'صورة' },
  { key: 'name', label: 'الاسم' },
  { key: 'description', label: 'الوصف' },
  { key: 'category', label: 'الفئة' },
  { key: 'size', label: 'الحجم' },
  { key: 'cartonQuantity', label: 'كمية الكرتون' },
  { key: 'cartonPrice', label: 'سعر الكرتون', price: true },
  { key: 'offerPrice', label: 'سعر العرض', price: true },
  { key: 'offerDetails', label: 'تفاصيل العرض', price: true },
];

const CHROME_LABELS: { key: keyof PresentationChrome; label: string }[] = [
  { key: 'logo', label: 'الشعار' },
  { key: 'companyInfo', label: 'اسم الشركة' },
  { key: 'contact', label: 'معلومات التواصل' },
  { key: 'pageNumbers', label: 'أرقام الصفحات' },
  { key: 'date', label: 'التاريخ' },
  { key: 'notes', label: 'الملاحظات' },
];

function Chip({ on, disabled, label, onClick }: { on: boolean; disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
        on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
      }`}
    >
      {label}
    </button>
  );
}

export function OptionsPanel({ options, onChange, showPricesGlobal }: Props) {
  const setField = (key: keyof PresentationFields, value: boolean) =>
    onChange({ fields: { ...options.fields, [key]: value } });
  const setChrome = (key: keyof PresentationChrome, value: boolean) =>
    onChange({ chrome: { ...options.chrome, [key]: value } });

  return (
    <div className="space-y-4">
      {/* Products per page */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">عدد المنتجات في الصفحة</p>
        <div className="flex gap-1.5">
          {PER_PAGE_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ perPage: n as PerPage })}
              className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                options.perPage === n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Product fields */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">محتوى المنتج</p>
        <div className="flex flex-wrap gap-1.5">
          {FIELD_LABELS.map((f) => {
            const disabled = f.price && !showPricesGlobal;
            return (
              <Chip
                key={f.key}
                label={f.label}
                on={options.fields[f.key] && !disabled}
                disabled={disabled}
                onClick={() => setField(f.key, !options.fields[f.key])}
              />
            );
          })}
        </div>
      </div>

      {/* Header / footer */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">الترويسة والتذييل</p>
        <div className="flex flex-wrap gap-1.5">
          {CHROME_LABELS.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              on={options.chrome[c.key]}
              onClick={() => setChrome(c.key, !options.chrome[c.key])}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
