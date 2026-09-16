import { z } from "zod";
import { webflowIdSchema } from "@/connectors/webflow/schemas";

export const startConnectionSchema = z.strictObject({ id: z.uuid(), workspaceId: z.uuid(), confirmed: z.literal("yes") });
export const sitePreviewInputSchema = z.strictObject({ id: z.uuid(), connectionId: z.uuid(), siteId: webflowIdSchema });
export const confirmSiteSchema = z.strictObject({ id: z.uuid(), confirmed: z.literal("yes") });
export const connectionSchema = z.object({
  id: z.uuid(), workspace_id: z.uuid(), actor_id: z.uuid(),
  status: z.enum(["pending", "exchanging", "ready"]), expires_at: z.string(),
});
export const linkedSiteSchema = z.object({
  id: z.uuid(), workspace_id: z.uuid(), connection_id: z.uuid(),
  webflow_site_id: webflowIdSchema, display_name: z.string(),
});
export const sitePreviewSchema = z.object({
  id: z.uuid(), workspace_id: z.uuid(), connection_id: z.uuid(), webflow_site_id: webflowIdSchema,
  display_name: z.string(), expires_at: z.string(), site_id: z.uuid().nullable(), expected_connection_id: z.uuid().nullable(),
});
export function safeOffset(value: string | undefined) {
  const result = z.coerce.number().int().min(0).max(1000000).safeParse(value ?? 0);
  return result.success ? result.data : 0;
}
