import { previewScanSchema } from "./schema";

// Same payload for the two UI steps and the server-side preview validation.
export function parseScanSetup(form: FormData) {
  const searchText = form.get("searchText") ?? undefined;
  const selectedTypes = form.getAll("types");
  if (typeof searchText === "string" && searchText.trim() && !selectedTypes.includes("text")) selectedTypes.push("text");
  return previewScanSchema.safeParse({ id: form.get("id"), siteId: form.get("siteId"), source: form.get("source"), collectionIds: form.getAll("collectionIds"), types: selectedTypes, searchText, searchOptions: { ignoreCase: form.get("ignoreCase") === "on", ignoreAccents: form.get("ignoreAccents") === "on", wholeWord: form.get("wholeWord") === "on" } });
}
export function scanCollectionsValid(form: FormData) {
  return previewScanSchema.shape.collectionIds.safeParse(form.getAll("collectionIds")).success;
}
