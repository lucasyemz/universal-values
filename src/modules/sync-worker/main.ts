import { setTimeout } from "node:timers/promises";
import { createWorkerDatabase } from "@/connectors/supabase/worker";
import { encryptionKeySchema } from "@/connectors/webflow/config";
import { processWorkerTurn, workerConnection } from "./process";

async function main() {
  const key = encryptionKeySchema.safeParse(process.env.WEBFLOW_TOKEN_ENCRYPTION_KEY);
  if (!key.success) throw new Error("Configure a mesma WEBFLOW_TOKEN_ENCRYPTION_KEY usada pelo dashboard.");
  const database = createWorkerDatabase();
  let stopping = false;
  process.on("SIGINT", () => { stopping = true; });
  process.on("SIGTERM", () => { stopping = true; });
  console.log("Worker CMS ativo. Somente operações previamente confirmadas serão processadas.");
  while (!stopping) {
    try {
      const result = await processWorkerTurn(database, payload => workerConnection(payload, key.data));
      if (!result.idle) console.log(`CMS ${result.id}: ${result.status}`);
    } catch { console.error("Fila indisponível. Confira a migration 015, configuração e conexão do worker; nova consulta em 5 segundos."); }
    if (!stopping) await setTimeout(5000);
  }
  console.log("Worker encerrado. Operações pendentes permanecem no banco.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Falha na inicialização do worker."); process.exitCode = 1; });
