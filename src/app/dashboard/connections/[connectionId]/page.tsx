import { FreshLink } from "@/components/ui/fresh-link";
import { randomUUID } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import { loadAvailableSites, webflowMessage } from "@/modules/sites/service";
import { previewSiteConnection } from "@/modules/sites/actions";
import { PageHeader, Steps } from "@/components/ui";
import { SiteContext } from "@/components/layout/app-shell";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function ConnectionPage({ params, searchParams }: {
  params: Promise<{ connectionId: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { connectionId } = await params;
  const { error } = await searchParams;
  let view;
  try { view = await loadAvailableSites(connectionId); }
  catch (cause) {
    unstable_rethrow(cause);
    return <main className="ui-page"><FreshLink href="/dashboard" >Voltar aos workspaces</FreshLink><p role="alert" className="mt-6">{webflowMessage(cause)}</p></main>;
  }
  return <main className="ui-page">
    <SiteContext title="Conectar Webflow" workspaceId={view.connection.workspace_id} />
    <FreshLink href={"/dashboard/workspaces/" + view.connection.workspace_id + "/sites"} >← Sites do workspace</FreshLink>
    <PageHeader title="Escolha um site" description="Selecione um dos sites disponíveis na sua autorização do Webflow." />
    <Steps steps={["Autorizar", "Escolher site", "Revisar vínculo"]} current={1} />
    {error && <p role="alert" className="mt-4 text-amber-800">Não foi possível preparar o vínculo. Atualize a lista e tente novamente.</p>}
    {!view.sites.length && <p className="mt-8">Nenhum site foi autorizado. Volte e inicie uma nova conexão selecionando um site no Webflow.</p>}
    <ul className="mt-8 space-y-4">{view.sites.map((site) => <li key={site.id} className="ui-card p-6">
      <h2 className="text-lg font-semibold">{site.displayName}</h2><p className="mt-1 text-sm text-faint">{site.shortName}</p>
      <form action={previewSiteConnection} className="mt-4">
        <input type="hidden" name="id" value={randomUUID()} /><input type="hidden" name="connectionId" value={connectionId} /><input type="hidden" name="siteId" value={site.id} />
        <SubmitButton pendingLabel="Preparando vínculo…">Revisar vínculo</SubmitButton>
      </form>
    </li>)}</ul>
  </main>;
}
