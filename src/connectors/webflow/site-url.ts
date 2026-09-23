import type { WebflowSite } from "./schemas";

export function webflowPreviewUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const trusted = url.hostname === "screenshots.webflow.com" || url.hostname === "website-files.com" || url.hostname.endsWith(".website-files.com");
    return url.protocol === "https:" && trusted && !url.username && !url.password && !url.port ? url.href : null;
  } catch { return null; }
}

// Use provider metadata, never the ReplaceAll slug or the display name.
export function webflowSiteUrl(site: Pick<WebflowSite, "shortName" | "customDomains">): string | null {
  for (const domain of site.customDomains ?? []) {
    const candidate = domain.url.trim();
    if (candidate.startsWith("/") || /[\\\s]/.test(candidate)) continue;
    try {
      const url = new URL(candidate.includes("://") ? candidate : "https://" + candidate);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) continue;
      if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(url.hostname)) continue;
      return "https://" + url.hostname;
    } catch { /* Ignore invalid domain metadata and try the next domain. */ }
  }
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(site.shortName) ? "https://" + site.shortName.toLowerCase() + ".webflow.io" : null;
}
