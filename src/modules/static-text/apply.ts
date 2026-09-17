import { contextSchema, planSchema, type PageContext, type TextPlan } from "./plan";
import { z } from "zod";

export const auditSchema = z.object({
  plan: planSchema, confirmedAt: z.string(),
  status: z.enum(["confirmed", "dispatching", "applied", "already_applied", "conflict", "uncertain"]),
  nodeId: z.string().optional(), at: z.string(),
});
export type AuditEvent = z.infer<typeof auditSchema>;
export interface TextPort {
  context(): Promise<PageContext>;
  read(id: string): Promise<string | null>;
  write(id: string, text: string): Promise<void>;
}
export interface AuditStore {
  load(): AuditEvent[];
  append(event: AuditEvent): void;
}

function sameContext(a: PageContext, b: PageContext) {
  return a.siteId === b.siteId && a.pageId === b.pageId && a.rootId === b.rootId;
}

// The caller must hold an exclusive Web Lock throughout this operation.
export async function applyPlan(input: TextPlan, confirmed: boolean, port: TextPort, store: AuditStore) {
  const plan = planSchema.parse(input);
  if (!confirmed) throw new Error("Confirme a prévia antes de aplicar.");
  if (plan.expiresAt < Date.now()) throw new Error("Prévia expirada. Gere outra.");
  const existing = store.load().filter(event => event.plan.id === plan.id);
  if (existing.some(event => JSON.stringify(event.plan) !== JSON.stringify(plan))) throw new Error("Prévia alterada.");
  const confirmedAt = existing[0]?.confirmedAt ?? new Date().toISOString();
  const record = (status: AuditEvent["status"], nodeId?: string) => store.append({ plan, confirmedAt, status, nodeId, at: new Date().toISOString() });
  const checkContext = async () => {
    if (!sameContext(plan.context, contextSchema.parse(await port.context()))) throw new Error("A página ou o contexto mudou. Volte à página e gere outra prévia.");
  };
  await checkContext();
  // Check the whole batch before starting. Recheck each node immediately before dispatch.
  for (const change of plan.changes) {
    const current = await port.read(change.id);
    const completed = existing.some(event => event.nodeId === change.id && ["applied", "already_applied"].includes(event.status));
    if ((completed && current !== change.after) || (current !== change.before && current !== change.after)) {
      record("conflict", change.id);
      throw new Error("Um texto mudou ou deixou de ser editável. Nenhuma nova escrita foi iniciada.");
    }
  }
  if (!existing.length) record("confirmed");
  for (const change of plan.changes) {
    await checkContext();
    const history = store.load().filter(event => event.plan.id === plan.id && event.nodeId === change.id);
    if (history.some(event => ["applied", "already_applied"].includes(event.status))) continue;
    const current = await port.read(change.id);
    if (current === change.after) { record("already_applied", change.id); continue; }
    if (history.some(event => ["dispatching", "uncertain"].includes(event.status))) throw new Error("Resultado anterior incerto. Confira o texto no Designer; não repetimos a escrita.");
    if (current !== change.before) { record("conflict", change.id); throw new Error("Conflito de conteúdo. Faça uma nova busca."); }
    await checkContext();
    // Persist intent before touching Webflow. If storage fails, no write occurs.
    record("dispatching", change.id);
    try {
      await port.write(change.id, change.after);
      await checkContext();
      if (await port.read(change.id) !== change.after) throw new Error("Leitura após escrita diferente.");
    } catch {
      record("uncertain", change.id);
      throw new Error("Não foi possível confirmar o resultado. Confira o Designer e exporte o histórico. O lote pode estar parcialmente aplicado.");
    }
    record("applied", change.id);
  }
}
