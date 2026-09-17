import { z } from "zod";
import type { WebflowReader } from "@/connectors/webflow/client";
import { detectPage } from "./detect";
import { occurrenceInputSchema, SCAN_LIMITS, type Scan } from "./schema";

// One bounded unit of work. Persistent leases/cursors are handled by the service.
export async function readScanBatch(scan: Scan, siteId: string, reader: Pick<WebflowReader, "sites" | "collections" | "collection" | "items">) {
  const planned = scan.plan[scan.collection_index];
  if (!planned) return { rows: [], itemsRead: 0, nextCollection: scan.plan.length, nextOffset: 0, truncated: false, skippedFields: 0 };
  const [sites, collections] = await Promise.all([reader.sites(), reader.collections(siteId)]);
  if (!sites.some((site) => site.id === siteId)) throw new Error("source_changed");
  if (!collections.some((collection) => collection.id === planned.id)) throw new Error("source_changed");
  const [details, page] = await Promise.all([reader.collection(planned.id), reader.items(planned.id, scan.item_offset)]);
  if (details.id !== planned.id || page.pagination.offset !== scan.item_offset || page.items.length > 25 ||
      (page.items.length === 0 && page.pagination.offset < page.pagination.total)) throw new Error("invalid_page");
  const remaining = SCAN_LIMITS.items - scan.items_read;
  const selectedPage = { ...page, items: page.items.slice(0, Math.max(0, remaining)) };
  const detected = detectPage(details, selectedPage, planned.types ?? ["money", "phone", "date", "number", "text"], planned.searchText);
  const hasMore = page.pagination.offset + selectedPage.items.length < page.pagination.total;
  const available = SCAN_LIMITS.occurrences - scan.occurrences_count;
  return {
    rows: z.array(occurrenceInputSchema).parse(detected.rows.slice(0, available)),
    itemsRead: selectedPage.items.length,
    nextCollection: hasMore ? scan.collection_index : scan.collection_index + 1,
    nextOffset: hasMore ? scan.item_offset + selectedPage.items.length : 0,
    truncated: detected.truncated || detected.rows.length > available || page.items.length > remaining,
    skippedFields: detected.skippedFields,
  };
}
