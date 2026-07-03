/**
 * Shared building blocks for the settings pages (admin settings and the
 * representatives' display options) — one visual language for both.
 */

interface OptionGroupProps<T extends string> {
  label: string;
  description?: string;
  options: readonly { value: T; label: string; swatch?: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function OptionGroup<T extends string>({
  label,
  description,
  options,
  value,
  onChange,
}: OptionGroupProps<T>) {
  return (
    <div>
      <span className="block text-sm font-medium text-foreground mb-1">{label}</span>
      {description && <p className="text-xs text-muted-foreground mb-2">{description}</p>}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
              value === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {opt.swatch && (
              <span
                aria-hidden
                className="w-4 h-4 rounded-full border border-border shadow-sm"
                style={{ backgroundColor: opt.swatch }}
              />
            )}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ToggleSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ToggleSwitch({ label, description, checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-40 ${
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
            checked ? 'left-0.5' : 'left-[1.375rem]'
          }`}
        />
      </button>
    </div>
  );
}
