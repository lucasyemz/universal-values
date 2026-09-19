type Operation = { background_paused?: boolean; status: string; total: number; cursor: number; results: { status: string }[] };
export function syncOutcome(operation: Operation) {
  const verified = operation.results.filter(result => ["applied", "already_applied"].includes(result.status)).length;
  const issues = operation.results.filter(result => !["applied", "already_applied"].includes(result.status)).length;
  const remaining = Math.max(0, operation.total - operation.cursor);
  if (operation.status === "completed") return { verified, issues, remaining, badge: issues || verified !== operation.total ? "conflict" : "completed", label: issues || verified !== operation.total ? "Encerrada com pendências" : "Verificada no CMS" };
  if (operation.status === "confirmed") return { verified, issues, remaining, badge: operation.background_paused ? "paused" : "confirmed", label: operation.background_paused ? "Aguardando revisão" : "Na fila do servidor" };
  return { verified, issues, remaining, badge: operation.status, label: operation.status === "cancelled" ? "Cancelada" : "Aguardando confirmação" };
}
