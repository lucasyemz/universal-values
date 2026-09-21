import { z } from "zod";
export function legacySiteDestination(siteId: string, hash: string, section: "scans" | "static") {
  if(section === "static") {
    const id=z.uuid().safeParse(hash.slice(1));
    return id.success ? `/dashboard/sites/${siteId}/changes/${id.data}` : hash === "#history" ? `/dashboard/sites/${siteId}/changes?filter=static` : null;
  }
  const destinations: Record<string,string> = { "#new-scan": "scans/new", "#managed-values": "managed-values", "#changes": "changes" };
  const destination=destinations[hash];
  return destination ? `/dashboard/sites/${siteId}/${destination}` : null;
}
