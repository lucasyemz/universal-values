import { getText } from "@/i18n/server";
import { PlanUsage } from "@/components/layout/plan-usage";
import { quotaMessage } from "@/modules/plans/errors";
import Link from "next/link";
import { ArrowRight, Globe2, Plus, ShieldCheck } from "lucide-react";
import { getWorkspaceNavigation } from "@/components/layout/workspace-data";
import { Card, EmptyState, Notice, PageHeader, SectionHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string }> }) {
  const t = await getText();

  const workspaces = await getWorkspaceNavigation();
  const params = await searchParams;
  return <main className="ui-page">
    <PageHeader eyebrow={t("Seu centro de controle")} title={t("Visão geral")} description={t("Informações consistentes. Mudanças sob seu controle. Escolha um workspace para acessar seus sites.")} actions={<Link className="ui-btn ui-btn-primary" href="/dashboard/settings/webflow?new=1"><Plus size={16} />{t("Criar workspace")}</Link>} />
    {params.error && <Notice tone="danger" title={t("Não foi possível concluir")}>{quotaMessage(params.error) ?? t("Confira os dados e gere uma nova prévia se necessário.")}</Notice>}
    {params.created && <Notice tone="success" title={t("Workspace criado")}>{t("Agora você pode conectar seu site Webflow.")}</Notice>}
    <PlanUsage />
    <div className="grid items-start gap-8 xl:grid-cols-[1fr_340px]">
      <section aria-label={t("Workspaces disponíveis")}><SectionHeader title={t("Seus workspaces")} description={`${workspaces.length} ${workspaces.length === 1 ? t("workspace disponível") : t("workspaces disponíveis")}`} />
        {!workspaces.length ? <EmptyState title={t("Seu primeiro workspace")} description={t("Organize seus sites, scans e Managed Values em um só espaço. Comece criando um workspace.")} action={<Link href="/dashboard/settings/webflow?new=1" className="ui-btn ui-btn-primary">{t("Criar workspace")}</Link>} /> :
          <ul className="space-y-3">{workspaces.map((workspace) => <li key={workspace.id}><Link href={`/dashboard/workspaces/${workspace.id}/sites`} className="ui-card flex items-center gap-4 p-5 hover:border-accent"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><Globe2 size={21} /></span><div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold">{workspace.name}</h2><p className="mt-1 text-xs text-muted">{t("Sites, scans e valores centralizados")}</p></div><span className="hidden text-xs font-medium text-accent sm:block">{t("Abrir workspace")}</span><ArrowRight size={16} className="text-accent" /></Link></li>)}</ul>}
      </section>
      <aside className="space-y-5"><Card><ShieldCheck size={22} className="mb-4 text-accent" /><h2 className="text-base font-semibold">{t("Cada mudança, uma decisão sua.")}</h2><p className="mt-3 text-sm leading-6 text-muted">{t("O scan encontra as repetições. Você escolhe o que mudar, confere a prévia e confirma a aplicação no CMS.")}</p><div className="mt-6 space-y-4 border-t pt-5">{[t("Conecte um site Webflow"), t("Encontre e revise os valores"), t("Confirme as alterações")].map((step, i) => <p key={step} className="flex gap-3 text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-subtle text-xs text-muted">{i + 1}</span>{t(step)}</p>)}</div></Card><p className="px-2 text-xs leading-6 text-muted">{t("As atualizações ficam no CMS. A publicação do site continua sob seu controle no Webflow.")}</p></aside>
    </div>
  </main>;
}
