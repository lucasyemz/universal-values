import "server-only";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
import { getScanSite } from "./service";
import { resourceLink } from "@/modules/routes/links";
import { occurrenceSchema } from "./schema";
import { compatibleSavedScan, savedMatches, savedQuerySchema, savedScanSchema } from "./saved-search";

export async function searchSavedScans(siteId: string, term: string) {
  const query = savedQuerySchema.parse(term);
  if (!query) return null;
  await getScanSite(siteId);
  const { client, user } = await requireUser();
  const result = await client.from("cms_scans").select("id,site_id,actor_id,status,plan,created_at,truncated,skipped_fields")
    .eq("site_id", siteId).eq("actor_id", user.id).in("status", ["completed", "limited"])
    .order("created_at", { ascending: false }).order("id").limit(20);
  if (result.error) throw new Error("Não foi possível consultar os scans salvos.");
  const scan = z.array(savedScanSchema).parse(result.data).find(row => row.site_id === siteId && row.actor_id === user.id && compatibleSavedScan(row, query));
  if (!scan) return { scan: null, matches: [], href: null };
  const rows = await client.from("scan_occurrences").select("*").eq("scan_id", scan.id).eq("site_id", siteId).order("id").limit(1000);
  if (rows.error) throw new Error("Não foi possível consultar os scans salvos.");
  const occurrences = z.array(occurrenceSchema).parse(rows.data).filter(row => row.scan_id === scan.id && row.site_id === siteId);
  return { scan, matches: savedMatches(scan, occurrences, query), href: await resourceLink("scans", scan.id) };
}
