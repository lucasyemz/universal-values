import { dashboardMetadata } from "@/modules/dashboard/metadata";
import { redirect } from "next/navigation";
import { workspaceLink } from "@/modules/routes/links";
import { entryWorkspace } from "@/modules/workspaces/entry";

export async function generateMetadata() {
  return dashboardMetadata("home");
}

import { getText } from "@/i18n/server";
import { PlanUsage } from "@/components/layout/plan-usage";
import { quotaMessage } from "@/modules/plans/errors";
import Link from "next/link";
import { ArrowRight, Globe2, Plus, BookOpen, Lightbulb, File, ScanLine, Layers } from "lucide-react";
import { WorkspaceEdit } from "@/components/workspaces/workspace-edit";
import { workspaceOverviewCounts } from "@/modules/workspaces/overview";
import { getWorkspaceNavigation } from "@/components/layout/workspace-data";
import { Card, EmptyState, Notice, PageHeader, SectionHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string; workspaces?: string }> }) {
  const t = await getText();

  const workspaces = await getWorkspaceNavigation();
  const params = await searchParams;
  const destination = entryWorkspace(workspaces, params);
  if (destination) redirect(await workspaceLink(destination));
  const counts = await workspaceOverviewCounts();
  return <main className="ui-page">
    <PageHeader eyebrow={t("Seu centro de controle")} title={t("Visão geral")} description={t("Informações consistentes. Mudanças sob seu controle. Escolha um workspace para acessar seus sites.")} actions={<Link className="ui-btn ui-btn-primary" href="/dashboard/settings/webflow?new=1"><Plus size={16} />{t("Criar workspace")}</Link>} />
    {params.error && <Notice tone="danger" title={t("Não foi possível concluir")}>{quotaMessage(params.error) ?? t("Confira os dados e gere uma nova prévia se necessário.")}</Notice>}
    {params.created && <Notice tone="success" title={t("Workspace criado")}>{t("Agora você pode conectar seu site Webflow.")}</Notice>}
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.9fr)_minmax(300px,1fr)]">
      <section aria-label={t("Workspaces disponíveis")} className="min-w-0"><PlanUsage compact /><SectionHeader title={`${t("Seus workspaces")} · ${workspaces.length}`} />
        {!workspaces.length ? <EmptyState title={t("Seu primeiro workspace")} description={t("Organize seus sites, scans e Variáveis em um só espaço. Comece criando um workspace.")} action={<Link href="/dashboard/settings/webflow?new=1" className="ui-btn ui-btn-primary">{t("Criar workspace")}</Link>} /> :
          <ul className="space-y-4">{workspaces.map((workspace) => {
            const count=counts.find(row=>row.id===workspace.id);
            return <li key={workspace.id} className="ui-card p-5 sm:p-6"><div className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[56px_minmax(0,1fr)_auto] sm:gap-5"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Globe2 size={27}/></span><div className="min-w-0 flex-1"><h2 className="break-words text-base font-semibold">{workspace.name}</h2><p className="mt-1 text-sm text-muted">{t("Sites, scans e variáveis")}</p></div><div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1"><Link href={workspace.href} className="ui-btn text-accent">{t("Abrir workspace")}<ArrowRight size={16}/></Link><WorkspaceEdit workspace={workspace}/></div></div>
            {count&&<div className="mt-4 flex flex-wrap gap-2 sm:ml-[76px]">{[{icon:File,value:count.sites,label:t("sites")},{icon:ScanLine,value:count.scans,label:t("scans")},{icon:Layers,value:count.variables,label:t("Variáveis")}].map(stat=><span key={stat.label} className="inline-flex items-center gap-2 rounded-full bg-subtle px-3 py-2 text-xs text-muted"><stat.icon size={15}/>{stat.value} {stat.label}</span>)}</div>}</li>;
          })}</ul>}

      </section>
      <aside><Card className="bg-gradient-to-br from-accent-soft/50 via-white to-white"><span className="mb-5 inline-flex rounded-xl bg-accent-soft p-3 text-accent"><BookOpen size={24}/></span><h2 className="max-w-xs text-2xl font-semibold leading-tight tracking-tight">{t("Cada mudança, uma decisão sua.")}</h2><p className="mt-4 text-sm leading-6 text-muted">{t("O scan encontra as repetições. Você escolhe o que mudar, confere a prévia e confirma a aplicação no CMS.")}</p><ol className="mt-6 space-y-5 border-t pt-5">{[[t("Conecte um site Webflow"),t("Integre seu site em poucos cliques.")],[t("Encontre e revise os valores"),t("Veja as repetições e analise os resultados.")],[t("Confirme as alterações"),t("Confira a prévia e aplique no CMS.")]].map(([title,description],i)=><li key={title} className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{i+1}</span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-muted">{description}</p></div></li>)}</ol><div className="mt-6 flex gap-3 rounded-xl bg-accent-soft/60 p-4"><Lightbulb size={20} className="shrink-0 text-accent"/><div><p className="text-sm font-medium text-accent">{t("Dica")}</p><p className="mt-1 text-xs leading-5 text-muted">{t("As atualizações ficam no CMS. A publicação do site continua sob seu controle no Webflow.")}</p></div></div></Card></aside>
    </div>
  </main>;
}
