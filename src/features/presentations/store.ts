/**
 * Presentation Builder — device-local store (offline-first).
 *
 * Presentations and custom templates live in localStorage; history is capped at
 * MAX_PRESENTATIONS (20, newest first) so the store stays light — this is a
 * catalog tool, not an archive. Exposed as reactive snapshots via
 * useSyncExternalStore so the builder and the history drawer stay in sync.
 */
import { useSyncExternalStore } from 'react';
import {
  MAX_PRESENTATIONS,
  DEFAULT_OPTIONS,
  DEFAULT_OUTPUT,
  type Presentation,
  type PresentationTemplate,
} from './types';

const PRESENTATIONS_KEY = 'sarda_presentations';
const TEMPLATES_KEY = 'sarda_presentation_templates';

const isClient = typeof window !== 'undefined';

function readList<T>(key: string): T[] {
  if (!isClient) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

// ── Reactive caches ────────────────────────────────────────────────────────────
let presentationsCache: Presentation[] | null = null;
let templatesCache: PresentationTemplate[] | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getPresentations(): Presentation[] {
  if (presentationsCache) return presentationsCache;
  presentationsCache = readList<Presentation>(PRESENTATIONS_KEY);
  return presentationsCache;
}
function writePresentations(next: Presentation[]) {
  presentationsCache = next;
  if (isClient) {
    try {
      localStorage.setItem(PRESENTATIONS_KEY, JSON.stringify(next));
    } catch {
      /* storage full / private mode — stays in memory */
    }
  }
  emit();
}

function getTemplates(): PresentationTemplate[] {
  if (templatesCache) return templatesCache;
  templatesCache = readList<PresentationTemplate>(TEMPLATES_KEY);
  return templatesCache;
}
function writeTemplates(next: PresentationTemplate[]) {
  templatesCache = next;
  if (isClient) {
    try {
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
    } catch {
      /* best-effort */
    }
  }
  emit();
}

const EMPTY: never[] = [];

// ── Hooks ───────────────────────────────────────────────────────────────────────
export function usePresentations(): Presentation[] {
  return useSyncExternalStore(subscribe, getPresentations, () => EMPTY);
}
export function useCustomTemplates(): PresentationTemplate[] {
  return useSyncExternalStore(subscribe, getTemplates, () => EMPTY);
}

// ── Presentation CRUD ─────────────────────────────────────────────────────────
function now(): string {
  return new Date().toISOString();
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function uid(): string {
  return isClient && crypto.randomUUID ? crypto.randomUUID() : `p_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
}

/** A fresh, empty presentation seeded with default options. */
export function createPresentation(partial: Partial<Presentation> = {}): Presentation {
  const stamp = now();
  return {
    id: uid(),
    name: 'عرض جديد',
    createdAt: stamp,
    updatedAt: stamp,
    productIds: [],
    client: '',
    notes: '',
    date: today(),
    expiry: '',
    templateId: 'modern',
    options: { ...DEFAULT_OPTIONS, fields: { ...DEFAULT_OPTIONS.fields }, chrome: { ...DEFAULT_OPTIONS.chrome } },
    output: { ...DEFAULT_OUTPUT },
    ...partial,
  };
}

/**
 * Insert or update a presentation, keeping the list newest-first and capped at
 * MAX_PRESENTATIONS (oldest are dropped). Returns the saved record.
 */
export function savePresentation(p: Presentation): Presentation {
  const saved: Presentation = { ...p, updatedAt: now() };
  const rest = getPresentations().filter((x) => x.id !== saved.id);
  writePresentations([saved, ...rest].slice(0, MAX_PRESENTATIONS));
  return saved;
}

export function getPresentation(id: string): Presentation | undefined {
  return getPresentations().find((p) => p.id === id);
}

export function deletePresentation(id: string): void {
  writePresentations(getPresentations().filter((p) => p.id !== id));
}

export function clearPresentations(): void {
  writePresentations([]);
}

/** Duplicate a presentation as a new editable draft ("… — نسخة"). */
export function duplicatePresentation(id: string): Presentation | undefined {
  const src = getPresentation(id);
  if (!src) return undefined;
  return savePresentation(
    createPresentation({
      name: `${src.name} — نسخة`,
      productIds: [...src.productIds],
      client: src.client,
      notes: src.notes,
      expiry: src.expiry,
      templateId: src.templateId,
      options: { ...src.options, fields: { ...src.options.fields }, chrome: { ...src.options.chrome } },
      output: { ...src.output },
    }),
  );
}

// ── Custom templates ───────────────────────────────────────────────────────────
export function saveCustomTemplate(name: string, options: Presentation['options'], output: Presentation['output']): PresentationTemplate {
  const tpl: PresentationTemplate = {
    id: uid(),
    name: name.trim() || 'قالب',
    builtIn: false,
    options: { ...options, fields: { ...options.fields }, chrome: { ...options.chrome } },
    output: { ...output },
  };
  writeTemplates([...getTemplates().filter((t) => t.name !== tpl.name), tpl]);
  return tpl;
}

export function deleteCustomTemplate(id: string): void {
  writeTemplates(getTemplates().filter((t) => t.id !== id));
}
