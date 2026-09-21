import type { WebflowReader } from "@/connectors/webflow/client";

// Bounded, short-lived server metadata cache. Never store tokens or customer item bodies.
// Every caller must obtain a freshly authorized reader before using this cache.
export function createAiMetadataCache() {
  const entries = new Map<string, { expires: number; value: { collection: Awaited<ReturnType<WebflowReader["collection"]>>; site: Awaited<ReturnType<WebflowReader["sites"]>>[number] } }>();
  return async (scope: string, siteId: string, collectionId: string, reader: Pick<WebflowReader, "sites" | "collections" | "collection">) => {
    const key = JSON.stringify([scope, siteId, collectionId]);
    const cached = entries.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;
    entries.delete(key);
    const [sites, collections] = await Promise.all([reader.sites(), reader.collections(siteId)]);
    const site = sites.find(row => row.id === siteId);
    if (!site || !collections.some(row => row.id === collectionId)) throw new Error("Source unavailable");
    const collection = await reader.collection(collectionId);
    if (collection.id !== collectionId) throw new Error("Source unavailable");
    const value = { site, collection };
    if (entries.size >= 100) entries.delete(entries.keys().next().value!);
    entries.set(key, { value, expires: Date.now() + 5 * 60_000 });
    return value;
  };
}
export const readAiMetadata = createAiMetadataCache();
