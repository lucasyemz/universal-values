import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("workspaceWebflow");
}

import { getText } from "@/i18n/server";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { getWebflowConfig } from "@/connectors/webflow/config";
import { loadWorkspaceSites, settingsAvailableSites } from "@/modules/sites/service";
import { startWebflowConnection, previewSiteConnection, revokeWebflowAccess } from "@/modules/sites/actions";
import { designerSessions } from "@/modules/static-text/dashboard-service";
import { revokeDesignerAccess } from "@/modules/static-text/dashboard-actions";
import { DesignerAuthorization } from "@/components/designer-authorization";
import { SiteContext } from "@/components/layout/app-shell";
import { PageHeader, DataTable, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function Settings({params,searchParams}: {params: Promise<{workspaceId:string}>;searchParams:Promise<{sites?:string;error?:string;revoked?:string}>}) {
  const t = await getText();

 const {workspaceId}=await params; const query=await searchParams;
 const view=await loadWorkspaceSites(workspaceId);
 const base="/dashboard/workspaces/"+workspaceId+"/settings/webflow";
 const {available,failed}=await settingsAvailableSites(view.connections,!!query.sites);
 const designer=await Promise.all(view.sites.map(site=>designerSessions(site.id)));
 return <main className="ui-page"><SiteContext title={t("Configurações do Webflow")} workspaceId={workspaceId}/>
 <PageHeader eyebrow={view.name} title={t("Configurações do Webflow")} description={t("Gerencie o acesso ao CMS, os sites vinculados e a extensão do Designer.")} actions={<Link href="/dashboard/settings/webflow?new=1" className="ui-btn">{t("Trocar ou criar workspace")}</Link>}/>
 {query.error&&<p role="alert" className="mt-4">{query.error==="revoke"?t("Não foi possível revogar. Conclua ou cancele alterações em andamento e tente novamente."):t("A conexão não foi concluída. Confira as permissões e tente novamente.")}</p>}
 {query.revoked&&<p role="status" className="mt-4">{t("Acesso ao CMS revogado no ReplaceAll. Seus sites e histórico foram preservados.")}</p>}
 <section className="ui-card mt-6 p-6"><h2 className="text-lg font-semibold">Webflow · {view.connections.length?t("Conectado"):t("Não conectado")}</h2><p className="mt-2 text-sm text-muted">{t("O acesso ao CMS fica salvo até ser revogado. Para incluir outro site ou workspace do Webflow, conecte e selecione as permissões desejadas.")}</p>
 {getWebflowConfig()?<details className="mt-4" open={!view.connections.length||undefined}><summary className="ui-btn w-fit">{t("Conectar Webflow")}</summary><form action={startWebflowConnection} className="mt-4 space-y-4"><input type="hidden" name="id" value={randomUUID()}/><input type="hidden" name="workspaceId" value={workspaceId}/><p className="text-sm">{t("Autorizar leitura de sites e leitura e edição do CMS para")} {view.name}{t(". Alterações exigem prévia e confirmação; não publicamos seu site automaticamente.")}</p><label className="flex gap-2 text-sm"><input required type="checkbox" name="confirmed" value="yes"/>{t("Autorizo este acesso ao Webflow.")}</label><SubmitButton pendingLabel={t("Abrindo Webflow…")}>{t("Continuar no Webflow")}</SubmitButton></form></details>:<p>{t("Integração indisponível. Contate o administrador.")}</p>}
 {!!view.connections.length&&<details className="mt-4"><summary className="ui-btn w-fit">{t("Revogar acesso ao CMS")}</summary><form action={revokeWebflowAccess} className="mt-4 space-y-4"><input type="hidden" name="id" value={randomUUID()}/><input type="hidden" name="workspaceId" value={workspaceId}/>{view.connections.map(c=><input key={c.id} type="hidden" name="connection" value={c.id}/>)}<p className="text-sm">{t("Interrompe o acesso do ReplaceAll ao CMS neste workspace. Sites e histórico permanecem. Para remover também a autorização do aplicativo na sua conta, use as configurações de Apps do Webflow. O acesso ao Designer é independente e pode ser revogado abaixo.")}</p><label className="flex gap-2 text-sm"><input required type="checkbox" name="confirmed" value="yes"/>{t("Confirmo a revogação do acesso ao CMS de")} {view.name}.</label><SubmitButton pendingLabel={t("Revogando…")} variant="secondary">{t("Confirmar revogação")}</SubmitButton></form></details>}
 </section>
 <section className="ui-card mt-6 p-6"><h2 className="text-lg font-semibold">{t("Sites e coleções")}</h2><p className="mt-2 text-sm text-muted">{t("Coleções novas ficam disponíveis ao preparar um novo scan, sem outra conexão. Se faltar um site, inclua-o em Conectar Webflow.")}</p><div className="mt-4 flex flex-wrap gap-3">{view.sites.map(site=><Link key={site.id} className="ui-btn" href={"/dashboard/sites/"+site.id+"/scans/new"}>{site.display_name}  {t("· Escolher coleções")}</Link>)}</div>
 {!!view.connections.length&&<Link className="ui-btn mt-4" href={base+"?sites=1"}>{t("Buscar sites disponíveis")}</Link>}
 {failed&&<p role="alert" className="mt-3">{t("Algumas permissões não puderam ser consultadas. Tente novamente ou reconecte o Webflow.")}</p>}
 {query.sites&&!failed&&!available.length&&<p className="mt-3">{t("Nenhum site disponível nesta autorização.")}</p>}
 <ul className="mt-4 space-y-3">{available.map(site=><li key={site.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><span>{site.displayName}</span><form action={previewSiteConnection}><input type="hidden" name="id" value={randomUUID()}/><input type="hidden" name="connectionId" value={site.connectionId}/><input type="hidden" name="siteId" value={site.id}/><SubmitButton pendingLabel={t("Preparando…")} variant="secondary">{view.sites.some(s=>s.webflow_site_id===site.id)?t("Revisar conexão"):t("Conectar site")}</SubmitButton></form></li>)}</ul></section>
 <section id="designer" className="mt-8"><h2 className="mb-4 text-xl font-semibold">{t("Extensão do Designer")}</h2><p className="mb-4 text-sm text-muted">{t("Autorize o acesso ao histórico e o registro de prévias por 30 dias. Alterações no site exigem confirmação no Designer.")}</p>
 {designer.length > 0 && <DataTable label={t("Extensão do Designer")}><thead><tr><th>{t("Site")}</th><th>Status</th><th>{t("Código de conexão")}</th><th>{t("Ações")}</th></tr></thead><tbody>{designer.map(v=><tr key={v.site.id}><td className="align-top"><Link className="block max-w-56 truncate font-semibold hover:underline" title={v.site.display_name} href={"/dashboard/sites/"+v.site.id+"/overview"}>{v.site.display_name}</Link></td><td className="align-top"><StatusBadge status={v.unavailable?"uncertain":v.sessions.length?"connected":"disconnected"} label={v.unavailable?t("Status indisponível"):v.sessions.length?t("Conectado"):t("Não conectado")}/></td><td className="align-top"><DesignerAuthorization id={randomUUID()} siteId={v.site.id} name={v.site.display_name}/></td><td className="align-top">{!!v.sessions.length&&<details><summary className="ui-btn w-fit">{t("Revogar acesso ao Designer")}</summary><form action={revokeDesignerAccess} className="ui-card mt-3 space-y-4 p-5"><input type="hidden" name="siteId" value={v.site.id}/>{v.sessions.map(s=><input key={s.id} type="hidden" name="session" value={s.id}/>)}<p className="text-sm">{t("Interrompe todas as conexões atuais do Designer para este site. Uma alteração já enviada pode terminar.")}</p><label className="flex gap-2 text-sm"><input required type="checkbox" name="confirmed" value="yes"/>{t("Confirmo a revogação para")} {v.site.display_name}.</label><SubmitButton variant="secondary" pendingLabel={t("Revogando…")}>{t("Confirmar revogação")}</SubmitButton></form></details>}{!v.sessions.length&&<span className="text-muted">—</span>}</td></tr>)}</tbody></DataTable>}
 {!designer.length&&<p className="text-sm text-muted">{t("Conecte um site para autorizar sua extensão.")}</p>}</section></main>;
}
