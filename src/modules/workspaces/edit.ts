import { z } from "zod";
import { workspaceNameSchema } from "./schema";
export const workspaceSlugSchema = z.string().min(1).max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .refine(value => !["sites", "settings", "workspaces", "plan", "api"].includes(value));
export const workspaceEditInput = z.object({id:z.uuid(),workspace:z.uuid(),name:workspaceNameSchema,slug:workspaceSlugSchema}).strict();
export const workspaceEditPreview = z.object({id:z.uuid(),beforeName:z.string(),beforeSlug:z.string(),name:z.string(),slug:workspaceSlugSchema});
export type WorkspaceEditPreview = z.infer<typeof workspaceEditPreview>;
export function workspaceEditError(error: {message:string} | null) {
  if (error?.message.includes("WORKSPACE_SLUG_TAKEN")) return "Este endereço já está em uso por outro workspace. Escolha outro slug.";
  if (error?.message.includes("WORKSPACE_EDIT_STALE")) return "A prévia expirou ou o workspace mudou. Volte e revise novamente.";
  return "Não foi possível editar o workspace. Atualize a página e tente novamente.";
}
