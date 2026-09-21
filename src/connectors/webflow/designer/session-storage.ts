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
