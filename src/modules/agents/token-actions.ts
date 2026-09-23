"use server";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
const tokenRow = z.object({ id: z.uuid(), name: z.string(), workspace_id: z.uuid(), scope: z.literal("copyreplace:read"), created_at: z.string(), expires_at: z.string(), revoked_at: z.string().nullable() });
export async function listMcpTokens() {
  try {
    const { client } = await requireUser();
    const { data, error } = await client.rpc("manage_mcp_token", { p_action: "list" });
    if (error) return { ok: false as const };
    return { ok: true as const, tokens: z.array(tokenRow).parse(data) };
  } catch { return { ok: false as const }; }
}
export async function issueMcpToken(input: unknown) {
  const parsed = z.strictObject({ id: z.uuid(), workspace: z.uuid(), name: z.string().trim().min(1).max(80), confirmed: z.literal(true) }).safeParse(input);
  if (!parsed.success) return { ok: false as const };
  try {
    const { client } = await requireUser();
    const token = "cr_mcp_" + randomBytes(32).toString("hex");
    const { error } = await client.rpc("manage_mcp_token", { p_action: "issue", p_id: parsed.data.id, p_workspace: parsed.data.workspace, p_name: parsed.data.name, p_hash: createHash("sha256").update(token).digest("hex") });
    if (error) return { ok: false as const };
    return { ok: true as const, token };
  } catch { return { ok: false as const }; }
}
export async function revokeMcpToken(input: unknown) {
  const parsed = z.strictObject({ id: z.uuid(), confirmed: z.literal(true) }).safeParse(input);
  if (!parsed.success) return { ok: false };
  try {
    const { client } = await requireUser();
    const { error } = await client.rpc("manage_mcp_token", { p_action: "revoke", p_id: parsed.data.id });
    return { ok: !error };
  } catch { return { ok: false }; }
}
