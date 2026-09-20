// Run with Deno after worker:edge:build. No network permission or real credentials.
import { edgeWorker } from "../supabase/functions/cms-worker/worker.js";
const secret = "a".repeat(64);
const env = { CMS_WORKER_CRON_SECRET: secret, SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-only", WEBFLOW_TOKEN_ENCRYPTION_KEY: "b".repeat(64) };
let calls = 0;
globalThis.fetch = async (input, init) => {
  calls++;
  if (!String(input).endsWith("/rest/v1/rpc/claim_background_cms")) throw new Error("Unexpected gateway access");
  const lease = JSON.parse(init.body).p_lease;
  if (lease === null) return Response.json({ code: "P0001", message: "Invalid lease" }, { status: 400 });
  if (typeof lease !== "string" || !/^[0-9a-f-]{36}$/.test(lease)) throw new Error("Invalid claim lease");
  return Response.json(null);
};
const unauthorized = await edgeWorker(new Request("https://example.test", { method: "POST", body: '{"mode":"run"}' }), env);
if (unauthorized.status !== 401 || calls !== 0) throw new Error("Unauthorized request reached the database");
const checked = await edgeWorker(new Request("https://example.test", { method: "POST", headers: { "x-worker-secret": secret }, body: '{"mode":"check"}' }), env);
if (checked.status !== 200 || calls !== 1 || (await checked.json()).mode !== "check") throw new Error("Read-only check failed in Deno");
const idle = await edgeWorker(new Request("https://example.test", { method: "POST", headers: { "x-worker-secret": secret }, body: '{"mode":"run"}' }), env);
if (idle.status !== 200 || calls !== 2 || (await idle.json()).idle !== true) throw new Error("Idle turn failed in Deno");
console.log("Deno: bundle loaded, private authentication read-only gateway check and idle turn passed (mock transport).");
