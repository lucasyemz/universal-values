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
  const [usage, params] = await Promise.all([getPlanUsage(), searchParams]);
  const admin = usage.plan === "admin";
  const target = params.target === "free" || params.target === "admin" ? params.target : null;
  const reviewing = usage.canSwitch && target && target !== usage.plan;
  const rows = [
    { label: "Sites conectados", used: usage.sites, limit: 1, detail: "Total entre todos os seus workspaces" },
    { label: "Scans confirmados", used: usage.scans, limit: 5, detail: "Por mês" },
    { label: "Campos CMS confirmados", used: usage.fields, limit: 50, detail: "Por mês, incluindo sincronizações e reversões" },
    { label: "Operações ativas", used: usage.active, limit: 1, detail: "Scans em andamento ou pausados e alterações CMS" },
    { label: "Preparações de operações", used: usage.previews, limit: 200, detail: "Por mês" },
    { label: "Acessos à integração", used: usage.reads, limit: 1000, detail: "Por mês; cada acesso pode consultar vários endpoints" },
    { label: "Solicitações de preparação e integração", used: usage.requests, limit: 60, detail: "No minuto atual" },
  ];
  return <main className="ui-page">
    <PageHeader title="Plano e consumo" description="Consulte seus limites e gerencie o plano desta conta." actions={<Link href="/dashboard/plan" className="ui-btn">Atualizar consumo</Link>} />
    {params.error && <Notice tone="danger">{errors[params.error] ?? errors.invalid}</Notice>}
    {params.changed && <Notice tone="success">Plano salvo na sua conta. Ele permanece ativo nas próximas sessões até você trocar novamente.</Notice>}
    {usage.paused && !admin && <Notice tone="warning">Novas operações gratuitas estão temporariamente pausadas pela capacidade do aplicativo.</Notice>}
    <Card className="mb-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-muted">Plano atual</p><h2 className="mt-2 text-xl font-semibold">{admin ? "Administrador" : "Free"}</h2><p className="mt-2 text-sm text-muted">{admin ? "Sem cotas comerciais. Limites técnicos e dos provedores continuam valendo." : "Gratuito, com limites de uso para manter o serviço disponível."}</p></div><p className="text-xs text-muted">Renovação mensal: {new Date(usage.resetsAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })} · 00h UTC</p></div></Card>
    <SectionHeader title="Seu consumo" description="Valores consultados ao abrir ou atualizar esta página." />
    {admin && <p className="mb-4 text-sm text-muted">Os contadores mensais e por minuto mostram o consumo registrado enquanto você usou o Free. Operações feitas como Administrador não entram nessas cotas. Sites e operações ativas mostram o total atual.</p>}
    <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{rows.map(row => <Card key={row.label}><h3 className="text-sm font-medium">{row.label}</h3><p className="my-3 text-2xl font-semibold">{row.used} <span className="text-sm font-normal text-muted">/ {admin ? "sem cota" : row.limit}</span></p>{!admin && <Progress value={Math.min(row.used, row.limit)} max={row.limit} label={`${row.label}: ${row.used} de ${row.limit}`} />}<p className="mt-2 text-xs text-muted">{row.detail}</p></Card>)}</div>
    <p className="mb-8 text-sm text-muted">Até {admin ? 500 : 100} itens por scan novo. A confirmação reserva a cota; falhas e cancelamentos não devolvem consumo. Repetir a mesma confirmação não consome novamente. A capacidade global do serviço também pode limitar novas operações Free.</p>
    <SectionHeader title="Gerenciar plano" description={usage.canSwitch ? "Escolha o plano e revise antes de confirmar. A escolha vale para todos os seus dispositivos." : "Seu plano gratuito já está ativo. Ainda não há um plano pago disponível para upgrade."} />
    <div className="grid gap-4 md:grid-cols-2"><Card><h3 className="font-semibold">Free</h3><p className="my-3 text-sm text-muted">1 site · 5 scans/mês · 100 itens/scan · 50 campos CMS/mês · 1 operação ativa.</p>{!admin ? <span className="text-sm font-medium text-accent">Plano atual</span> : usage.canSwitch && <Link href="/dashboard/plan?target=free#review" className="ui-btn">Revisar troca para Free</Link>}</Card>
    {usage.canSwitch && <Card><h3 className="font-semibold">Administrador</h3><p className="my-3 text-sm text-muted">Acesso reservado à administração, sem as cotas comerciais do Free. Não é um plano pago.</p>{admin ? <span className="text-sm font-medium text-accent">Plano atual</span> : <Link href="/dashboard/plan?target=admin#review" className="ui-btn ui-btn-primary">Revisar troca para Administrador</Link>}</Card>}</div>
    {reviewing && <Card id="review" className="mt-6"><SectionHeader title={`Confirmar troca para ${target === "free" ? "Free" : "Administrador"}`} /><p className="mb-4 text-sm text-muted">{target === "free" ? "As cotas Free serão aplicadas às novas operações. Sites e histórico existentes serão mantidos, mesmo acima do limite. Conclua ou cancele operações ativas antes da troca." : "Sua conta volta a operar sem as cotas comerciais do Free. Limites técnicos e dos provedores permanecem."} A troca não zera seu consumo Free e fica salva até uma nova mudança.</p><form action={selectAccountPlan} className="space-y-4"><input type="hidden" name="id" value={randomUUID()} /><input type="hidden" name="plan" value={target} /><input type="hidden" name="expected" value={usage.plan} /><label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirmed" required />Revisei os limites e confirmo a troca de plano desta conta.</label><div className="flex flex-wrap gap-3"><SubmitButton pendingLabel="Salvando plano…">Confirmar troca</SubmitButton><Link href="/dashboard/plan" className="ui-btn">Cancelar</Link></div></form></Card>}
  </main>;
}
