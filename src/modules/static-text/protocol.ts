import { z } from "zod";
import { planSchema, searchSchema } from "./plan";
import { auditSchema } from "./apply";

export const sessionCodeSchema = z.string().regex(/^uvd_[a-f0-9]{64}$/);
export const gatewaySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("home"), webflowSiteId: z.string().regex(/^[a-f0-9]{24}$/i) }),
  z.object({ action: z.literal("preview"), webflowSiteId: z.string().regex(/^[a-f0-9]{24}$/i), plan: planSchema, searchText: searchSchema }),
  z.object({ action: z.literal("events"), webflowSiteId: z.string().regex(/^[a-f0-9]{24}$/i), id: z.uuid() }),
  z.object({ action: z.literal("event"), webflowSiteId: z.string().regex(/^[a-f0-9]{24}$/i), id: z.uuid(), event: auditSchema }),
]);
export const homeSchema = z.object({
  siteId: z.uuid(), siteName: z.string(), workspaceId: z.uuid(), webflowSiteId: z.string(), expiresAt: z.string(),
  recent: z.array(z.object({ id: z.uuid(), page_name: z.string(), created_at: z.string(), total: z.number(), applied: z.number() })),
});
export type DesignerHome = z.infer<typeof homeSchema>;
export type GatewayInput = z.infer<typeof gatewaySchema>;

export function allowedDesignerOrigin(origin: string | null, configured: string) {
  if (!origin) return false;
  return configured.split(",").map(item => item.trim()).filter(Boolean).includes(origin);
}
