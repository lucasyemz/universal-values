import { connectionFailure } from "./connection-errors";
import { createHash } from "node:crypto";
import type { WebflowSite } from "@/connectors/webflow/schemas";

// Stable per authorization/site; callback retries never allocate a new operation.
export function connectionSiteKey(connectionId: string, siteId: string) {
  const hex = createHash("sha256").update(`connect-site:${connectionId}:${siteId}`).digest("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

export async function connectAuthorizedSites(sites: WebflowSite[], deps: {
  connect: (site: WebflowSite) => Promise<void>;
}) {
  let connected = 0;
  let failed = 0;
  const reasons: string[] = [];
  for (const site of new Map(sites.map(site => [site.id, site])).values()) {
    try { await deps.connect(site); connected++; }
    catch (error) { failed++; reasons.push(connectionFailure(error)); }
  }
  return { connected, failed, ...(reasons.length ? { reasons } : {}) };
}
