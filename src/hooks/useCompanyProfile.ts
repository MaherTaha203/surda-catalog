/**
 * useCompanyProfile — the ONE place the app reads company identity.
 *
 * Text fields (name, tagline, contact) are admin-owned catalog settings (shared
 * via the server); the logo stays device-local (a localStorage data URL, like
 * the PIN). Everything that needs company info — the catalog header, the
 * presentation builder, generated PDFs — reads it from here, so there is a
 * single source of truth and no duplicated company data anywhere.
 */
import { useCatalogSettings } from '@/hooks/useCatalogSettings';
import { useIsClient } from '@/hooks/useIsClient';
import { getCompanyLogo } from '@/lib/storage';

export interface CompanyProfile {
  name: string;
  tagline: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  address: string;
  /** Device-local logo (data URL) or '' when none is set. */
  logo: string;
}

export function useCompanyProfile(): CompanyProfile {
  const settings = useCatalogSettings();
  const isClient = useIsClient();
  return {
    name: settings.companyName,
    tagline: settings.companyTagline,
    phone: settings.companyPhone,
    whatsapp: settings.companyWhatsapp,
    email: settings.companyEmail,
    website: settings.companyWebsite,
    address: settings.companyAddress,
    logo: isClient ? getCompanyLogo() : '',
  };
}

/** True when at least one contact channel is filled (drives footer visibility). */
export function hasContactInfo(p: CompanyProfile): boolean {
  return Boolean(p.phone || p.whatsapp || p.email || p.website || p.address);
}
