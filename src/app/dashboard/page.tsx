import { PlanUsage } from "@/components/layout/plan-usage";
import { quotaMessage } from "@/modules/plans/errors";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { ArrowRight, Globe2, Plus, ShieldCheck } from "lucide-react";
import { getWorkspaceNavigation } from "@/components/layout/workspace-data";
import { previewWorkspace } from "@/modules/workspaces/actions";
import { Card, EmptyState, Notice, PageHeader, SectionHeader } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string }> }) {
  const workspaces = await getWorkspaceNavigation();
  const params = await searchParams;
  return <main className="ui-page">
    <PageHeader eyebrow="Seu centro de controle" title="Visão geral" description="Informações consistentes. Mudanças sob seu controle. Escolha um workspace para acessar seus sites." actions={<Link className="ui-btn ui-btn-primary" href="#create-workspace"><Plus size={16} />Criar workspace</Link>} />
    {params.error && <Notice tone="danger" title="Não foi possível concluir">{quotaMessage(params.error) ?? "Confira os dados e gere uma nova prévia se necessário."}</Notice>}
    {params.created && <Notice tone="success" title="Workspace criado">Agora você pode conectar seu site Webflow.</Notice>}
    <PlanUsage />
    <div className="grid items-start gap-8 xl:grid-cols-[1fr_340px]">
      <section aria-label="Workspaces disponíveis"><SectionHeader title="Seus workspaces" description={`${workspaces.length} ${workspaces.length === 1 ? "workspace disponível" : "workspaces disponíveis"}`} />
        {!workspaces.length ? <EmptyState title="Seu primeiro workspace" description="Organize seus sites, scans e Managed Values em um só espaço. Comece criando um workspace." action={<Link href="#create-workspace" className="ui-btn ui-btn-primary">Criar workspace</Link>} /> :
          <ul className="space-y-3">{workspaces.map((workspace) => <li key={workspace.id}><Link href={`/dashboard/workspaces/${workspace.id}/sites`} className="ui-card flex items-center gap-4 p-5 hover:border-accent"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><Globe2 size={21} /></span><div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold">{workspace.name}</h2><p className="mt-1 text-xs text-muted">Sites, scans e valores centralizados</p></div><span className="hidden text-xs font-medium text-accent sm:block">Abrir workspace</span><ArrowRight size={16} className="text-accent" /></Link></li>)}</ul>}
        <Card className="mt-8" id="create-workspace"><SectionHeader title="Criar workspace" description="Dê um nome ao espaço que vai reunir seus sites." /><form action={previewWorkspace} className="space-y-4"><input type="hidden" name="id" value={randomUUID()} /><label className="block text-sm font-medium">Nome do workspace<input name="name" required minLength={2} maxLength={80} className="mt-2 block w-full" placeholder="Minha empresa" /></label><p className="text-xs text-muted">Você será o proprietário. Revise o nome na próxima etapa.</p><SubmitButton pendingLabel="Preparando revisão…">Revisar criação<ArrowRight size={15} /></SubmitButton></form></Card>
      </section>
      <aside className="space-y-5"><Card><ShieldCheck size={22} className="mb-4 text-accent" /><h2 className="text-base font-semibold">Cada mudança, uma decisão sua.</h2><p className="mt-3 text-sm leading-6 text-muted">O scan encontra as repetições. Você escolhe o que mudar, confere a prévia e confirma a aplicação no CMS.</p><div className="mt-6 space-y-4 border-t pt-5">{["Conecte um site Webflow", "Encontre e revise os valores", "Confirme as alterações"].map((step, i) => <p key={step} className="flex gap-3 text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-subtle text-xs text-muted">{i + 1}</span>{step}</p>)}</div></Card><p className="px-2 text-xs leading-6 text-muted">As atualizações ficam no CMS. A publicação do site continua sob seu controle no Webflow.</p></aside>
    </div>
  </main>;
}
