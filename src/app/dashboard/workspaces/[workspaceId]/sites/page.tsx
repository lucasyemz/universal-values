import { FreshLink } from "@/components/ui/fresh-link";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getWebflowConfig } from "@/connectors/webflow/config";
import { loadWorkspaceSites } from "@/modules/sites/service";
import { startWebflowConnection } from "@/modules/sites/actions";
import { PageHeader, StatusBadge, DataTable, EmptyState, SectionHeader } from "@/components/ui";
import { SiteContext } from "@/components/layout/app-shell";
import { SubmitButton } from "@/components/ui/submit-button";
import { Globe2, Plus, ScanLine } from "lucide-react";

export default async function WorkspaceSitesPage({ params, searchParams }: {
  params: Promise<{ workspaceId: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { workspaceId } = await params;
  const view = await loadWorkspaceSites(workspaceId);
  const configured = !!getWebflowConfig();
  const { error } = await searchParams;
  return <main className="ui-page">
    <SiteContext title={view.name} workspaceId={workspaceId} />
    <FreshLink href="/dashboard" >← Workspaces</FreshLink>
    <PageHeader eyebrow={view.name} title="Seus sites" description="Conecte o Webflow e mantenha as informações do seu CMS organizadas." actions={<Link href="#connect-webflow" className="ui-btn ui-btn-primary"><Plus size={16} />Conectar site</Link>} />
    {error && <p role="alert" className="mt-6 rounded border border-amber-200 bg-amber-50 p-4">{error === "denied" ? "A autorização foi cancelada no Webflow." : "A conexão não foi concluída. Confira as permissões e inicie uma nova autorização."}</p>}
    {view.missingMigration ? <p role="status" className="mt-8 rounded border border-amber-200 bg-amber-50 p-5">A configuração de sites ainda está pendente. Aplique a migration Webflow indicada no README para continuar.</p> : <>
      <section aria-label="Sites conectados" className="mt-8">
        <SectionHeader title="Sites vinculados" description={`${view.sites.length} sites neste workspace`} />
        {view.sites.length ? <DataTable label="Sites vinculados"><thead><tr><th>Site</th><th>Plataforma</th><th>Vínculo</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{view.sites.map((site) => <tr key={site.id}><td><Link href={"/dashboard/sites/" + site.id} className="flex items-center gap-3 font-semibold"><Globe2 size={18} className="text-accent" />{site.display_name}</Link></td><td className="text-muted">Webflow</td><td><StatusBadge status="connected" /></td><td><Link className="ui-btn" href={"/dashboard/sites/" + site.id + "/scans"}><ScanLine size={15} />Scans e valores</Link></td></tr>)}</tbody></DataTable> : <EmptyState title="Conecte seu primeiro site" description="Encontre informações repetidas no CMS e revise o que deseja atualizar." action={<Link href="#connect-webflow" className="ui-btn ui-btn-primary">Conectar Webflow</Link>} />}
      </section>
      {view.connections.length > 0 && <section className="mt-8"><h2 className="font-semibold">Autorizações disponíveis</h2><ul className="mt-3 space-y-2">{view.connections.map((connection, index) => <li key={connection.id}><Link className="ui-btn" href={"/dashboard/connections/" + connection.id}>Selecionar site da autorização {index + 1}</Link></li>)}</ul></section>}
      <section id="connect-webflow" className="mt-10 max-w-2xl ui-card p-6">
        <h2 className="text-xl font-semibold">Conectar Webflow</h2>
        <p className="mt-3 leading-7 text-muted">Você autorizará a leitura de sites e a leitura e edição do CMS. Alterações exigem uma prévia e sua confirmação no app; o site não será publicado automaticamente. Depois, revise qual site será vinculado a este workspace.</p>
        {!configured ? <p role="status" className="mt-5 text-sm text-amber-800">A integração precisa ser configurada antes da primeira conexão. Siga o guia Webflow no README.</p> :
          <form action={startWebflowConnection} className="mt-6 space-y-5">
            <input type="hidden" name="id" value={randomUUID()} /><input type="hidden" name="workspaceId" value={workspaceId} />
            <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" name="confirmed" value="yes" required />Autorizo conectar o Webflow com leitura de sites e leitura e escrita no CMS para este workspace.</label>
            <SubmitButton pendingLabel="Abrindo Webflow…">Continuar no Webflow</SubmitButton>
          </form>}
      </section>
    </>}
  </main>;
}
