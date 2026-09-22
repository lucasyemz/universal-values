import { searchOptionsLabel } from "../text-search/match";
import { z } from "zod";
import { auditSchema } from "./apply";
import { planSchema } from "./plan";

export function summarizeDesignerChange(input: { plan: unknown; events: unknown; expires_at: string }, now = Date.now()) {
  const plan = planSchema.parse(input.plan);
  const events = z.array(auditSchema).parse(input.events).filter(event => event.plan.id === plan.id);
  const changes = plan.changes.map(change => {
    const event = events.filter(event => event.nodeId === change.id).at(-1);
    const claimed = event?.status === "applied" || event?.status === "already_applied";
    const status = claimed && event?.observed !== change.after ? "reported" : event?.status;
    return { ...change, status, observed: event?.observed };
  });
  const verified = changes.filter(change => change.status === "applied" || change.status === "already_applied").length;
  const uncertain = changes.some(change => change.status === "uncertain" || change.status === "dispatching");
  const conflict = changes.some(change => change.status === "conflict");
  const reported = changes.some(change => change.status === "reported");
  const status = uncertain ? "Resultado pendente de verificação" : conflict ? "Conflito de conteúdo" : reported ? "Aplicação informada pela extensão · sem leitura registrada" : verified === changes.length ? "Verificada no Designer" : verified > 0 ? "Parcialmente verificada" : events.some(event => event.status === "confirmed") ? "Confirmada · sem resultado verificado" : Date.parse(input.expires_at) <= now ? "Prévia expirada" : "Aguardando confirmação";
  return { pageName: plan.context.pageName, changes, verified, status, searchDescription: plan.changes[0]?.link ? "Links da página" : searchOptionsLabel(plan.searchOptions) };
}
