import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { z } from "zod";

const secretSchema = z.string().regex(/^[0-9a-f]{64}$/);
const inputSchema = z.strictObject({ mode: z.enum(["check", "run"]) });
type Dependencies = {
  secret: string | undefined;
  check(): Promise<void>;
  run(): Promise<{ idle: boolean; status?: string;processed?:number }>;
};

export async function handleWorkerRequest(request: Request, dependencies: Dependencies): Promise<Response> {
  const reply = (status: number, data: object) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });
  const expected = secretSchema.safeParse(dependencies.secret);
  if (!expected.success) return reply(503, { error: "worker_not_configured" });
  const supplied = secretSchema.safeParse(request.headers.get("x-worker-secret"));
  if (!supplied.success || !timingSafeEqual(Buffer.from(supplied.data), Buffer.from(expected.data))) return reply(401, { error: "unauthorized" });
  // Bound body consumption independently of an untrusted Content-Length header.
  const reader = request.body?.getReader();
  let body = "";
  if (reader) {
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > 256) { await reader.cancel(); return reply(413, { error: "payload_too_large" }); }
      chunks.push(chunk.value);
    }
    body = Buffer.concat(chunks).toString("utf8");
  }
  let input: z.infer<typeof inputSchema>;
  try { input = inputSchema.parse(JSON.parse(body)); }
  catch { return reply(400, { error: "invalid_payload" }); }
  try {
    if (input.mode === "check") { await dependencies.check(); return reply(200, { ok: true, mode: "check" }); }
    const result = await dependencies.run();
    return reply(result.status === "worker_error" ? 503 : 200, { ok: result.status !== "worker_error", idle: result.idle, ...(result.status ? { status: result.status } : {}),...(result.processed!==undefined?{processed:result.processed}:{}) });
  } catch { return reply(503, { error: "worker_unavailable" }); }
}
