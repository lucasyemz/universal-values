import { z } from "zod";
const draftSchema = z.object({ version: z.literal(1), source: z.string(), value: z.string().max(10000), expires: z.number() });
export const DRAFT_TTL = 30 * 24 * 60 * 60 * 1000;
export const draftKey = (userId: string, scanId: string, occurrenceId: string) => `copyreplace:draft:v1:${userId}:${scanId}:${occurrenceId}`;
export function readDraft(storage: Pick<Storage, "getItem" | "removeItem">, key: string, source: string, now = Date.now()): string | undefined {
  const raw = storage.getItem(key);
  if (!raw) return;
  let parsed;
  try { parsed = draftSchema.safeParse(JSON.parse(raw)); } catch { storage.removeItem(key); return; }
  if (!parsed.success || parsed.data.expires <= now || parsed.data.source !== source) { storage.removeItem(key); return; }
  return parsed.data.value;
}
export function writeDraft(storage: Pick<Storage, "setItem" | "removeItem">, key: string, source: string, value: string | undefined, original: string, now = Date.now()) {
  if (value === undefined || value === original) { storage.removeItem(key); return; }
  storage.setItem(key, JSON.stringify(draftSchema.parse({ version: 1, source, value, expires: now + DRAFT_TTL })));
}
