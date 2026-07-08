/**
 * Presentation Builder — shared types.
 *
 * A "presentation" is a lightweight, device-local document: an ordered list of
 * catalog product ids plus display options. It is NOT an ERP record — history is
 * capped at 20 and everything lives in localStorage (offline-first). Product data
 * is always resolved live from the catalog by id, so a presentation never holds a
 * stale copy of a product.
 */

export type OutputType = 'pdf' | 'images';
export type PdfSize = 'A4' | 'A5' | 'Letter';
/** Products per page — shared by the preview and both outputs. */
export type PerPage = 4 | 6 | 9 | 12;
export type TemplateStyle = 'modern' | 'classic' | 'minimal';

/** Which product fields appear on each card. */
export interface PresentationFields {
  image: boolean;
  name: boolean;
  description: boolean;
  category: boolean;
  size: boolean;
  cartonQuantity: boolean;
  cartonPrice: boolean;
  offerPrice: boolean;
  offerDetails: boolean; // offer quantity + bonus quantity
}

/** Header / footer chrome (all sourced from the single Company Profile). */
export interface PresentationChrome {
  logo: boolean;
  companyInfo: boolean; // name + tagline
  contact: boolean; // phone / whatsapp / email / website / address
  pageNumbers: boolean;
  date: boolean;
  notes: boolean;
}

export interface PresentationOptions {
  style: TemplateStyle;
  perPage: PerPage;
  fields: PresentationFields;
  chrome: PresentationChrome;
}

export interface PresentationOutput {
  type: OutputType;
  pdfSize: PdfSize;
}

export interface Presentation {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Presentation order — independent from catalog order. */
  productIds: string[];
  client: string;
  notes: string;
  /** ISO date the presentation is dated (regenerate stamps today). */
  date: string;
  expiry: string;
  templateId: string;
  options: PresentationOptions;
  output: PresentationOutput;
}

/** A named snapshot of options+output. Built-ins ship with the app; customs are local. */
export interface PresentationTemplate {
  id: string;
  name: string;
  builtIn: boolean;
  options: PresentationOptions;
  output: PresentationOutput;
}

export const MAX_PRESENTATIONS = 20;
export const PER_PAGE_OPTIONS: PerPage[] = [4, 6, 9, 12];
export const PDF_SIZES: PdfSize[] = ['A4', 'A5', 'Letter'];

export const DEFAULT_FIELDS: PresentationFields = {
  image: true,
  name: true,
  description: false,
  category: false,
  size: true,
  cartonQuantity: false,
  cartonPrice: true,
  offerPrice: true,
  offerDetails: true,
};

export const DEFAULT_CHROME: PresentationChrome = {
  logo: true,
  companyInfo: true,
  contact: true,
  pageNumbers: true,
  date: true,
  notes: false,
};

export const DEFAULT_OPTIONS: PresentationOptions = {
  style: 'modern',
  perPage: 6,
  fields: { ...DEFAULT_FIELDS },
  chrome: { ...DEFAULT_CHROME },
};

export const DEFAULT_OUTPUT: PresentationOutput = { type: 'pdf', pdfSize: 'A4' };

/** Built-in templates (ids are stable; selecting one applies its options+output). */
export const BUILTIN_TEMPLATES: PresentationTemplate[] = [
  {
    id: 'modern',
    name: 'عصري',
    builtIn: true,
    options: { ...DEFAULT_OPTIONS },
    output: { ...DEFAULT_OUTPUT },
  },
  {
    id: 'classic',
    name: 'كلاسيكي',
    builtIn: true,
    options: {
      style: 'classic',
      perPage: 4,
      fields: { ...DEFAULT_FIELDS, description: true, cartonQuantity: true },
      chrome: { ...DEFAULT_CHROME },
    },
    output: { ...DEFAULT_OUTPUT },
  },
  {
    id: 'minimal',
    name: 'بسيط',
    builtIn: true,
    options: {
      style: 'minimal',
      perPage: 9,
      fields: { ...DEFAULT_FIELDS, size: false, offerPrice: false, offerDetails: false },
      chrome: { ...DEFAULT_CHROME, contact: false, notes: false },
    },
    output: { ...DEFAULT_OUTPUT },
  },
  {
    id: 'no-prices',
    name: 'بدون أسعار',
    builtIn: true,
    options: {
      style: 'modern',
      perPage: 6,
      fields: {
        ...DEFAULT_FIELDS,
        cartonPrice: false,
        offerPrice: false,
        offerDetails: false,
        cartonQuantity: true,
        description: true,
      },
      chrome: { ...DEFAULT_CHROME },
    },
    output: { ...DEFAULT_OUTPUT },
  },
];
