import { GeminiUsage } from "@/components/ai/usage";
import { getText } from "@/i18n/server";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getPlanUsage } from "@/modules/plans/service";
import { selectAccountPlan } from "@/modules/plans/actions";
import { Card, Notice, PageHeader, Progress, SectionHeader } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";

const errors: Record<string, string> = {
  plan_forbidden: "Esta conta não está habilitada para o plano solicitado.",
  plan_stale: "Seu plano mudou em outra aba. Confira o plano atual e revise a troca novamente.",
  plan_active: "Conclua ou cancele as operações ativas, inclusive scans pausados, antes de mudar para Free.",
  invalid: "Não foi possível trocar o plano. Revise a escolha e confirme novamente.",
};
export default async function PlanPage({ searchParams }: { searchParams: Promise<{ target?: string; error?: string; changed?: string }> }) {
  const t = await getText();

  const [usage, params] = await Promise.all([getPlanUsage(), searchParams]);
  const admin = usage.plan === "admin";
  const target = params.target === "free" || params.target === "admin" ? params.target : null;
  const reviewing = usage.canSwitch && target && target !== usage.plan;
  const rows = [
    { label: t("Sites conectados"), used: usage.sites, limit: 1, detail: t("Total entre todos os seus workspaces") },
    { label: t("Scans confirmados"), used: usage.scans, limit: 5, detail: t("Por mês") },
    { label: t("Campos CMS confirmados"), used: usage.fields, limit: 50, detail: t("Por mês, incluindo sincronizações e reversões") },
    { label: t("Operações ativas"), used: usage.active, limit: 1, detail: t("Scans em andamento ou pausados e alterações CMS") },
    { label: t("Preparações de operações"), used: usage.previews, limit: 200, detail: t("Por mês") },
    { label: t("Acessos à integração"), used: usage.reads, limit: 1000, detail: t("Por mês; cada acesso pode consultar vários endpoints") },
    { label: t("Solicitações de preparação e integração"), used: usage.requests, limit: 60, detail: t("No minuto atual") },
  ];
  return <main className="ui-page">
    <PageHeader title={t("Plano e consumo")} description={t("Consulte seus limites e gerencie o plano desta conta.")} actions={<Link href="/dashboard/plan" className="ui-btn">{t("Atualizar consumo")}</Link>} />
    {params.error && <Notice tone="danger">{t(errors[params.error] ?? errors.invalid)}</Notice>}
    {params.changed && <Notice tone="success">{t("Plano salvo na sua conta. Ele permanece ativo nas próximas sessões até você trocar novamente.")}</Notice>}
    {usage.paused && !admin && <Notice tone="warning">{t("Novas operações gratuitas estão temporariamente pausadas pela capacidade do aplicativo.")}</Notice>}
    <Card className="mb-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-muted">{t("Plano atual")}</p><h2 className="mt-2 text-xl font-semibold">{admin ? t("Administrador") : "Free"}</h2><p className="mt-2 text-sm text-muted">{admin ? t("Sem cotas comerciais. Limites técnicos e dos provedores continuam valendo.") : t("Gratuito, com limites de uso para manter o serviço disponível.")}</p></div><p className="text-xs text-muted">{t("Renovação mensal:")} {new Date(usage.resetsAt).toLocaleDateString(t.dateLocale, { timeZone: "UTC" })}  {t("· 00h UTC")}</p></div></Card>
    <SectionHeader title={t("Seu consumo")} description={t("Valores consultados ao abrir ou atualizar esta página.")} />
    {admin && <p className="mb-4 text-sm text-muted">{t("Os contadores mensais e por minuto mostram o consumo registrado enquanto você usou o Free. Operações feitas como Administrador não entram nessas cotas. Sites e operações ativas mostram o total atual.")}</p>}
    <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{rows.map(row => <Card key={row.label}><h3 className="text-sm font-medium">{t(row.label)}</h3><p className="my-3 text-2xl font-semibold">{row.used} <span className="text-sm font-normal text-muted">/ {admin ? t("sem cota") : row.limit}</span></p>{!admin && <Progress value={Math.min(row.used, row.limit)} max={row.limit} label={`${t(row.label)}: ${row.used} / ${row.limit}`} />}<p className="mt-2 text-xs text-muted">{t(row.detail)}</p></Card>)}</div>
    <p className="mb-8 text-sm text-muted">{t("Até")} {admin ? 500 : 100}  {t("itens por scan novo. A confirmação reserva a cota; falhas e cancelamentos não devolvem consumo. Repetir a mesma confirmação não consome novamente. A capacidade global do serviço também pode limitar novas operações Free.")}</p>
    <GeminiUsage />
    <SectionHeader title={t("Gerenciar plano")} description={usage.canSwitch ? t("Escolha o plano e revise antes de confirmar. A escolha vale para todos os seus dispositivos.") : t("Seu plano gratuito já está ativo. Ainda não há um plano pago disponível para upgrade.")} />
    <div className="grid gap-4 md:grid-cols-2"><Card><h3 className="font-semibold">Free</h3><p className="my-3 text-sm text-muted">{t("1 site · 5 scans/mês · 100 itens/scan · 50 campos CMS/mês · 1 operação ativa.")}</p>{!admin ? <span className="text-sm font-medium text-accent">{t("Plano atual")}</span> : usage.canSwitch && <Link href="/dashboard/plan?target=free#review" className="ui-btn">{t("Revisar troca para Free")}</Link>}</Card>
    {usage.canSwitch && <Card><h3 className="font-semibold">{t("Administrador")}</h3><p className="my-3 text-sm text-muted">{t("Acesso reservado à administração, sem as cotas comerciais do Free. Não é um plano pago.")}</p>{admin ? <span className="text-sm font-medium text-accent">{t("Plano atual")}</span> : <Link href="/dashboard/plan?target=admin#review" className="ui-btn ui-btn-primary">{t("Revisar troca para Administrador")}</Link>}</Card>}</div>
    {reviewing && <Card id="review" className="mt-6"><SectionHeader title={t("Confirmar troca para {0}", target === "free" ? "Free" : "Administrador")} /><p className="mb-4 text-sm text-muted">{target === "free" ? t("As cotas Free serão aplicadas às novas operações. Sites e histórico existentes serão mantidos, mesmo acima do limite. Conclua ou cancele operações ativas antes da troca.") : t("Sua conta volta a operar sem as cotas comerciais do Free. Limites técnicos e dos provedores permanecem.")}  {t("A troca não zera seu consumo Free e fica salva até uma nova mudança.")}</p><form action={selectAccountPlan} className="space-y-4"><input type="hidden" name="id" value={randomUUID()} /><input type="hidden" name="plan" value={target} /><input type="hidden" name="expected" value={usage.plan} /><label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirmed" required />{t("Revisei os limites e confirmo a troca de plano desta conta.")}</label><div className="flex flex-wrap gap-3"><SubmitButton pendingLabel={t("Salvando plano…")}>{t("Confirmar troca")}</SubmitButton><Link href="/dashboard/plan" className="ui-btn">{t("Cancelar")}</Link></div></form></Card>}
  </main>;
}
