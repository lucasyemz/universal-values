import Link from "next/link";
import { randomUUID } from "node:crypto";
import { getWebflowConfig } from "@/connectors/webflow/config";
import { loadWorkspaceSites, settingsAvailableSites } from "@/modules/sites/service";
import { startWebflowConnection, previewSiteConnection, revokeWebflowAccess } from "@/modules/sites/actions";
import { designerSessions } from "@/modules/static-text/dashboard-service";
import { revokeDesignerAccess } from "@/modules/static-text/dashboard-actions";
import { DesignerAuthorization } from "@/components/designer-authorization";
import { SiteContext } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function Settings({params,searchParams}: {params: Promise<{workspaceId:string}>;searchParams:Promise<{sites?:string;error?:string;revoked?:string}>}) {
 const {workspaceId}=await params; const query=await searchParams;
 const view=await loadWorkspaceSites(workspaceId);
 const base="/dashboard/workspaces/"+workspaceId+"/settings/webflow";
 const {available,failed}=await settingsAvailableSites(view.connections,!!query.sites);
 const designer=await Promise.all(view.sites.map(site=>designerSessions(site.id)));
 return <main className="ui-page"><SiteContext title="Configurações do Webflow" workspaceId={workspaceId}/>
 <PageHeader eyebrow={view.name} title="Configurações do Webflow" description="Gerencie o acesso ao CMS, os sites vinculados e a extensão do Designer." actions={<Link href="/dashboard/settings/webflow?new=1" className="ui-btn">Trocar ou criar workspace</Link>}/>
 {query.error&&<p role="alert" className="mt-4">{query.error==="revoke"?"Não foi possível revogar. Conclua ou cancele alterações em andamento e tente novamente.":"A conexão não foi concluída. Confira as permissões e tente novamente."}</p>}
 {query.revoked&&<p role="status" className="mt-4">Acesso ao CMS revogado no CopyReplace. Seus sites e histórico foram preservados.</p>}
 <section className="ui-card mt-6 p-6"><h2 className="text-lg font-semibold">Webflow · {view.connections.length?"Conectado":"Não conectado"}</h2><p className="mt-2 text-sm text-muted">O acesso ao CMS fica salvo até ser revogado. Para incluir outro site ou workspace do Webflow, conecte e selecione as permissões desejadas.</p>
 {getWebflowConfig()?<details className="mt-4" open={!view.connections.length||undefined}><summary className="ui-btn w-fit">Conectar Webflow</summary><form action={startWebflowConnection} className="mt-4 space-y-4"><input type="hidden" name="id" value={randomUUID()}/><input type="hidden" name="workspaceId" value={workspaceId}/><p className="text-sm">Autorizar leitura de sites e leitura e edição do CMS para {view.name}. Alterações exigem prévia e confirmação; não publicamos seu site automaticamente.</p><label className="flex gap-2 text-sm"><input required type="checkbox" name="confirmed" value="yes"/>Autorizo este acesso ao Webflow.</label><SubmitButton pendingLabel="Abrindo Webflow…">Continuar no Webflow</SubmitButton></form></details>:<p>Integração indisponível. Contate o administrador.</p>}
 {!!view.connections.length&&<details className="mt-4"><summary className="ui-btn w-fit">Revogar acesso ao CMS</summary><form action={revokeWebflowAccess} className="mt-4 space-y-4"><input type="hidden" name="id" value={randomUUID()}/><input type="hidden" name="workspaceId" value={workspaceId}/>{view.connections.map(c=><input key={c.id} type="hidden" name="connection" value={c.id}/>)}<p className="text-sm">Interrompe o acesso do CopyReplace ao CMS neste workspace. Sites e histórico permanecem. Para remover também a autorização do aplicativo na sua conta, use as configurações de Apps do Webflow. O acesso ao Designer é independente e pode ser revogado abaixo.</p><label className="flex gap-2 text-sm"><input required type="checkbox" name="confirmed" value="yes"/>Confirmo a revogação do acesso ao CMS de {view.name}.</label><SubmitButton pendingLabel="Revogando…" variant="secondary">Confirmar revogação</SubmitButton></form></details>}
 </section>
 <section className="ui-card mt-6 p-6"><h2 className="text-lg font-semibold">Sites e coleções</h2><p className="mt-2 text-sm text-muted">Coleções novas ficam disponíveis ao preparar um novo scan, sem outra conexão. Se faltar um site, inclua-o em Conectar Webflow.</p><div className="mt-4 flex flex-wrap gap-3">{view.sites.map(site=><Link key={site.id} className="ui-btn" href={"/dashboard/sites/"+site.id+"/scans/new"}>{site.display_name} · Escolher coleções</Link>)}</div>
 {!!view.connections.length&&<Link className="ui-btn mt-4" href={base+"?sites=1"}>Buscar sites disponíveis</Link>}
 {failed&&<p role="alert" className="mt-3">Algumas permissões não puderam ser consultadas. Tente novamente ou reconecte o Webflow.</p>}
 {query.sites&&!failed&&!available.length&&<p className="mt-3">Nenhum site disponível nesta autorização.</p>}
 <ul className="mt-4 space-y-3">{available.map(site=><li key={site.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><span>{site.displayName}</span><form action={previewSiteConnection}><input type="hidden" name="id" value={randomUUID()}/><input type="hidden" name="connectionId" value={site.connectionId}/><input type="hidden" name="siteId" value={site.id}/><SubmitButton pendingLabel="Preparando…" variant="secondary">{view.sites.some(s=>s.webflow_site_id===site.id)?"Revisar conexão":"Conectar site"}</SubmitButton></form></li>)}</ul></section>
 <section id="designer" className="mt-8"><h2 className="mb-4 text-xl font-semibold">Extensão do Designer</h2><p className="mb-4 text-sm text-muted">Novas conexões duram 30 dias e ficam salvas neste navegador. Conexões antigas mantêm o prazo original; gere um novo código para usar o novo prazo.</p>
 {designer.map(v=><div key={v.site.id} className="mb-6"><h3 className="mb-3 font-semibold">{v.site.display_name} · {v.unavailable?"Status indisponível":v.sessions.length?"Conectado":"Não conectado"}</h3><DesignerAuthorization id={randomUUID()} siteId={v.site.id} name={v.site.display_name}/>{!!v.sessions.length&&<details className="mt-3"><summary className="ui-btn w-fit">Revogar acesso ao Designer</summary><form action={revokeDesignerAccess} className="ui-card mt-3 space-y-4 p-5"><input type="hidden" name="siteId" value={v.site.id}/>{v.sessions.map(s=><input key={s.id} type="hidden" name="session" value={s.id}/>)}<p className="text-sm">Interrompe todas as conexões atuais do Designer para este site. Uma alteração já enviada pode terminar.</p><label className="flex gap-2 text-sm"><input required type="checkbox" name="confirmed" value="yes"/>Confirmo a revogação para {v.site.display_name}.</label><SubmitButton variant="secondary" pendingLabel="Revogando…">Confirmar revogação</SubmitButton></form></details>}</div>)}
 {!designer.length&&<p className="text-sm text-muted">Conecte um site para autorizar sua extensão.</p>}</section></main>;
}
