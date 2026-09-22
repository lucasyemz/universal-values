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
const dashboardPathSchema = z.string().regex(/^\/dashboard\/[a-z0-9-]+\/sites\/[a-z0-9-]+\/(overview|changes(?:\/[1-9][0-9]*|\?filter=static)?)$/);
export const homeSchema = z.object({
  siteId: z.uuid(), siteName: z.string(), workspaceId: z.uuid(), webflowSiteId: z.string(), expiresAt: z.string(),
  dashboardPath: dashboardPathSchema.optional(), changesPath: dashboardPathSchema.optional(),
  recent: z.array(z.object({ id: z.uuid(), href: dashboardPathSchema.optional(), page_name: z.string(), created_at: z.string(), total: z.number(), applied: z.number() })),
});
export type DesignerHome = z.infer<typeof homeSchema>;
export type GatewayInput = z.infer<typeof gatewaySchema>;

export function allowedDesignerOrigin(origin: string | null, configured: string) {
  if (!origin) return false;
  return configured.split(",").map(item => item.trim()).filter(Boolean).includes(origin);
}
