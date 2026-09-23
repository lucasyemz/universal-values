import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseConfig } from "@/connectors/supabase/config";
import type { Database, Json } from "@/connectors/supabase/types";
import { AgentError, errorSchema } from "@/modules/agents/contracts";

export function createMcpRepository(token: string) {
  const config = getSupabaseConfig();
  if (!config) throw new AgentError("UNAVAILABLE");
  const client = createClient<Database>(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000), cache: "no-store" }) } });
  let context: { workspace?: string; site?: string } = {};
  return {
    context: () => context,
    read: async (action: string, args: Record<string, unknown>) => {
      const { data, error } = await client.rpc("mcp_read", { p_token: token, p_action: action, p_args: args as Json });
      if (error) throw new AgentError("UNAVAILABLE");
      const failure = errorSchema.safeParse(data);
      if (failure.success) throw new AgentError(failure.data.error, failure.data.retryAfter);
      if (action === "authenticate") {
        const identity = z.object({ actor: z.uuid(), workspace: z.uuid(), scope: z.literal("copyreplace:read") }).parse(data);
        context = { workspace: identity.workspace };
        return identity;
      }
      const wrapped = z.object({ data: z.unknown(), workspace: z.uuid(), site: z.uuid() }).safeParse(data);
      if (wrapped.success) {
        context = { workspace: wrapped.data.workspace, site: wrapped.data.site };
        return wrapped.data.data;
      }
      return data;
    },
  };
}
