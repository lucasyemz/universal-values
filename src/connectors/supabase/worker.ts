import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "./types";

export function createWorkerDatabase(settings = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY }, fetcher: typeof fetch = fetch) {
  const config = z.object({ url: z.url(), key: z.string().min(1) }).safeParse(settings);
  if (!config.success) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente privado do worker.");
  const url = new URL(config.data.url);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("Supabase deve usar HTTPS ou localhost.");
  const client = createClient<Database>(config.data.url, config.data.key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetcher(input, { ...init, signal: AbortSignal.timeout(15000) }) } });
  return {
    async check() {
      // A null lease is rejected before heartbeat/claim mutations in migration 015.
      const response = await client.rpc("claim_background_cms", { p_lease: null });
      if (response.error?.code !== "P0001" || response.error.message !== "Invalid lease") throw new Error("Worker gateway unavailable");
    },
    async claim(lease: string): Promise<unknown> {
      const result = await client.rpc("claim_background_cms", { p_lease: lease });
      if (result.error) throw new Error("Não foi possível consultar a fila. Confira a migration 015, a credencial do worker e a conexão.");
      return result.data;
    },
    async step(id: string, cursor: number, lease: string, action: "dispatch" | "finish" | "pause", result?: Json, wait = 0) {
      const response = await client.rpc("background_cms_step", { p_id: id, p_cursor: cursor, p_lease: lease, p_action: action, p_result: result ?? null, p_wait: wait });
      if (response.error) throw new Error("Não foi possível registrar a etapa do worker.");
      return response.data;
    },
  };
}
export type WorkerDatabase = Pick<ReturnType<typeof createWorkerDatabase>, "claim" | "step">;
