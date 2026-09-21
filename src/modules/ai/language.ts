import type { WebflowSite } from "@/connectors/webflow/schemas";

export function siteContentLanguage(site: WebflowSite, cmsLocaleId: string): string | undefined {
  const locales = site.locales;
  const locale = cmsLocaleId
    ? [locales?.primary, ...(locales?.secondary ?? [])].find(item => item?.cmsLocaleId === cmsLocaleId)
    : locales?.primary;
  // An unknown localized item must not inherit a different locale's language.
  if (!locale) return undefined;
  try { return Intl.getCanonicalLocales(locale.tag)[0]; }
  catch { return undefined; }
}
