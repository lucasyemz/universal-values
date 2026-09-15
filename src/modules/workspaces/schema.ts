import { z } from "zod";

export const workspaceNameSchema = z.string().trim().min(2).max(80).regex(/^[^\p{Cc}]+$/u, "O nome não pode conter caracteres de controle.");
export const workspacePreviewInputSchema = z.strictObject({ id: z.uuid(), name: workspaceNameSchema });
export const workspaceConfirmationSchema = z.strictObject({ id: z.uuid(), confirmed: z.literal("yes") });
export const workspaceSchema = z.object({ id: z.uuid(), name: workspaceNameSchema, created_at: z.iso.datetime({ offset: true }) });
export const workspacePreviewSchema = z.object({
  id: z.uuid(), name: workspaceNameSchema, expires_at: z.iso.datetime({ offset: true }),
  workspace_id: z.uuid().nullable(), confirmed_at: z.iso.datetime({ offset: true }).nullable(),
});
