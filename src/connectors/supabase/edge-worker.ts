import {processWorkerBatch,WORKER_BUDGET_MS} from "@/modules/sync-worker/batch";
import { createWorkerDatabase } from "./worker";
import { encryptionKeySchema } from "@/connectors/webflow/config";
import { handleWorkerRequest } from "@/modules/sync-worker/edge-handler";
import { processWorkerTurn, workerConnection } from "@/modules/sync-worker/process";

type Environment = { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string; WEBFLOW_TOKEN_ENCRYPTION_KEY?: string; CMS_WORKER_CRON_SECRET?: string };
export function edgeWorker(request: Request, env: Environment) {
  // All network calls share this deadline, including multi-page reads. Existing
  // per-call timeouts remain active across at most three sequential fields.
  const started=performance.now();
  const deadline = AbortSignal.timeout(WORKER_BUDGET_MS);
  const fetcher: typeof fetch = (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([deadline, init.signal]) : deadline });
  const settings = { url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY };
  return handleWorkerRequest(request, {
    secret: env.CMS_WORKER_CRON_SECRET,
    check: async () => {
      encryptionKeySchema.parse(env.WEBFLOW_TOKEN_ENCRYPTION_KEY);
      await createWorkerDatabase(settings, fetcher).check();
    },
    run: async () => {
      const key = encryptionKeySchema.parse(env.WEBFLOW_TOKEN_ENCRYPTION_KEY);
      const database=createWorkerDatabase(settings,fetcher);
      return processWorkerBatch(()=>processWorkerTurn(database,payload=>workerConnection(payload,key,fetcher)),{remaining:()=>WORKER_BUDGET_MS-(performance.now()-started)});
    },
  });
}
