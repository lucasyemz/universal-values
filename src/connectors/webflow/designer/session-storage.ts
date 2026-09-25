import { z } from "zod";
import { sessionCodeSchema } from "../../../modules/static-text/protocol";
const key = "copyreplace:designer-session:v2";
const savedSchema = z.object({ code: sessionCodeSchema, site: z.string().min(1), expiresAt: z.iso.datetime({ offset: true }) });
export type SavedDesignerSession = z.infer<typeof savedSchema>;
export function readDesignerSession(storage: Pick<Storage,"getItem"|"removeItem">, now=Date.now()): SavedDesignerSession | null {
 try {
  const parsed=savedSchema.safeParse(JSON.parse(storage.getItem(key)??"null"));
  if(parsed.success && Date.parse(parsed.data.expiresAt)>now) return parsed.data;
  storage.removeItem(key);
 } catch { /* Storage may be disabled; a new connection is required. */ }
 return null;
}
export function saveDesignerSession(storage: Pick<Storage,"setItem">, session:SavedDesignerSession) {
 storage.setItem(key, JSON.stringify(savedSchema.parse(session)));
}
export function clearDesignerSession(storage: Pick<Storage,"removeItem">) { try {storage.removeItem(key);} catch { /* In-memory access is still cleared. */ } }

export type DesignerSessionScope = { site: string; origin: string };
const scopedKey = (scope: DesignerSessionScope) => `${key}:${JSON.stringify([new URL(scope.origin).origin,scope.site])}`;
export function readScopedDesignerSession(storage: Pick<Storage,"getItem"|"setItem"|"removeItem">, scope: DesignerSessionScope, now=Date.now()): SavedDesignerSession | null {
 const target=scopedKey(scope);
 try {
  const raw=storage.getItem(target);
  if(raw!==null){
   const parsed=savedSchema.safeParse(JSON.parse(raw));
   if(parsed.success&&parsed.data.site===scope.site&&Date.parse(parsed.data.expiresAt)>now)return parsed.data;
   storage.removeItem(target);return null;
  }
  // Migrate only the matching legacy session, retaining its original server expiry.
  const legacy=readDesignerSession(storage,now);
  if(legacy?.site!==scope.site)return null;
  storage.setItem(target,JSON.stringify(legacy));storage.removeItem(key);
  return legacy;
 } catch {return null;}
}
export function saveScopedDesignerSession(storage: Pick<Storage,"setItem">, scope: DesignerSessionScope, session: SavedDesignerSession) {
 const parsed=savedSchema.parse(session);
 if(parsed.site!==scope.site)throw new Error("Sessão de outro site.");
 storage.setItem(scopedKey(scope),JSON.stringify(parsed));
}
export function clearScopedDesignerSession(storage: Pick<Storage,"getItem"|"removeItem">, scope: DesignerSessionScope) {
 try {
  storage.removeItem(scopedKey(scope));
  const legacy=savedSchema.safeParse(JSON.parse(storage.getItem(key)??"null"));
  if(legacy.success&&legacy.data.site===scope.site)storage.removeItem(key);
 } catch { /* Server revocation remains authoritative. */ }
}
