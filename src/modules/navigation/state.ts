import { z } from "zod";
const stateSchema = z.object({ href: z.string().max(8000), y: z.number().nonnegative(), details: z.record(z.string(), z.boolean()), selections: z.record(z.string(), z.boolean()).default({}), savedAt: z.number() });
export type NavigationState = z.infer<typeof stateSchema>;
const ttl = 24 * 60 * 60 * 1000;
// Only DB-backed site views. Never restore running operations, errors, confirmations or provider routes.
export function stateHref(input: string) {
  const url = new URL(input, "https://copyreplace.local");
  if (url.origin !== "https://copyreplace.local" || !/^\/dashboard\/[a-z0-9-]+\/sites\/[a-z0-9-]+\/(overview|scans(?:\/\d+)?|managed-values(?:\/\d+)?|changes(?:\/\d+)?)$/.test(url.pathname)) return null;
  const params = new URLSearchParams();
  for (const key of ["q", "filter", "page", "group"]) {
    const value = url.searchParams.get(key);
    if (value && value.length <= (key === "group" ? 4000 : 200)) params.set(key, value);
  }
  return url.pathname + (params.size ? "?" + params : "");
}
export const stateKey = (userId: string, pathname: string) => `copyreplace:navigation:v1:${userId}:${pathname}`;
export function readNavigation(storage: Pick<Storage, "getItem">, userId: string, pathname: string, now = Date.now()) {
  try {
    const parsed = stateSchema.safeParse(JSON.parse(storage.getItem(stateKey(userId, pathname)) ?? "null"));
    if (!parsed.success || parsed.data.savedAt + ttl < now || parsed.data.savedAt > now || stateHref(parsed.data.href) !== parsed.data.href || parsed.data.href.split("?")[0] !== pathname) return null;
    return parsed.data;
  } catch { return null; }
}

// Exact source/range identity: changed or removed/protected rows cannot regain an old selection.
export const selectionStateKey = (id: string, source: string, start: number, end: number) => JSON.stringify([id, source, start, end]);
