/**
 * Presentation Builder — template dropdown (defaults + custom, brief §7 style).
 *
 * Built-in templates always remain; selecting one applies its options+output to
 * the current presentation. "حفظ الإعدادات كقالب" snapshots the current settings
 * as a named custom template; customs can be deleted.
 */
import { useState } from 'react';
import { LayoutTemplate, Check, Plus, Trash2, ChevronDown } from 'lucide-react';
import { BUILTIN_TEMPLATES, type PresentationTemplate } from './types';

interface Props {
  currentTemplateId: string;
  customTemplates: PresentationTemplate[];
  onSelect: (tpl: PresentationTemplate) => void;
  onSaveTemplate: (name: string) => void;
  onDeleteTemplate: (id: string) => void;
}

export function TemplateMenu({ currentTemplateId, customTemplates, onSelect, onSaveTemplate, onDeleteTemplate }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');

  const all = [...BUILTIN_TEMPLATES, ...customTemplates];
  const current = all.find((t) => t.id === currentTemplateId);

  const close = () => {
    setOpen(false);
    setSaving(false);
    setName('');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/70 transition-colors"
      >
        <LayoutTemplate size={15} aria-hidden />
        <span className="hidden sm:inline">{current?.name ?? 'قالب'}</span>
        <ChevronDown size={14} aria-hidden />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} aria-hidden />
          <div className="absolute z-50 mt-1 end-0 w-60 rounded-xl border border-border bg-background shadow-xl p-1.5 max-h-[70vh] overflow-y-auto" dir="rtl">
            <p className="text-[11px] font-medium text-muted-foreground px-2 py-1">افتراضية</p>
            {BUILTIN_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onSelect(t);
                  close();
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-muted text-sm text-foreground"
              >
                {t.name}
                {currentTemplateId === t.id && <Check size={14} className="text-primary" aria-hidden />}
              </button>
            ))}

            {customTemplates.length > 0 && (
              <>
                <p className="text-[11px] font-medium text-muted-foreground px-2 py-1 mt-1">قوالبي</p>
                {customTemplates.map((t) => (
                  <div key={t.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(t);
                        close();
                      }}
                      className="flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-muted text-sm text-foreground text-start"
                    >
                      {t.name}
                      {currentTemplateId === t.id && <Check size={14} className="text-primary" aria-hidden />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTemplate(t.id)}
                      aria-label={`حذف ${t.name}`}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 size={13} aria-hidden />
                    </button>
                  </div>
                ))}
              </>
            )}

            <div className="border-t border-border mt-1.5 pt-1.5">
              {saving ? (
                <div className="flex items-center gap-1.5 px-1">
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="اسم القالب"
                    className="flex-1 h-9 px-2.5 rounded-lg border border-border bg-background text-sm text-foreground"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && name.trim()) {
                        onSaveTemplate(name.trim());
                        close();
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={!name.trim()}
                    onClick={() => {
                      onSaveTemplate(name.trim());
                      close();
                    }}
                    className="px-3 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40"
                  >
                    حفظ
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSaving(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-sm text-foreground"
                >
                  <Plus size={15} aria-hidden /> حفظ الإعدادات كقالب
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
