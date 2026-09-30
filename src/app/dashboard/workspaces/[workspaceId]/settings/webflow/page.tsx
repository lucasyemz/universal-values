import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { getPlanUsage } from "@/modules/plans/service";
import { canCreateWorkspace } from "@/modules/workspaces/creation-policy";
import { quotaMessage } from "@/modules/plans/errors";
import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("workspaceWebflow");
}

import { connectionErrorMessage } from "@/modules/sites/connection-errors";
import { getText } from "@/i18n/server";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { getWebflowConfig } from "@/connectors/webflow/config";
import { siteLink } from "@/modules/routes/links";
import { loadWorkspaceSites } from "@/modules/sites/service";
import { startWebflowConnection, revokeWebflowAccess, retryWorkspaceConnection } from "@/modules/sites/actions";
import { designerSessions } from "@/modules/static-text/dashboard-service";
import { revokeDesignerAccess } from "@/modules/static-text/dashboard-actions";
import { DesignerAuthorization } from "@/components/designer-authorization";
import { SiteContext } from "@/components/layout/app-shell";
import { PageHeader, DataTable, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function Settings({params,searchParams}: {params: Promise<{workspaceId:string}>;searchParams:Promise<{sites?:string;error?:string;reason?:string;revoked?:string}>}) {
  const t = await getText();

 const {workspaceId}=await params; const query=await searchParams;
 const view=await loadWorkspaceSites(workspaceId);
 const atSiteLimit = !canCreateWorkspace(await getPlanUsage());
 const designer=await Promise.all(view.sites.map(site=>designerSessions(site.id)));
 const linkedSites=await Promise.all(view.sites.map(async site=>({...site,href:await siteLink(site.id)})));
 return <main className="ui-page"><SiteContext title={t("Configurações do Webflow")} workspaceId={workspaceId}/>
 <PageHeader eyebrow={view.name} title={t("Configurações do Webflow")} description={t("Gerencie o acesso ao CMS, os sites vinculados e a extensão do Designer.")} actions={<Link href="/dashboard/settings/webflow?new=1" className="ui-btn">{t("Trocar ou criar workspace")}</Link>}/>
 {query.error&&<p role="alert" className="mt-4">{query.error==="site-connection"?t(connectionErrorMessage(query.reason)):query.error==="revoke"?t("Não foi possível revogar. Conclua ou cancele alterações em andamento e tente novamente."):t("A conexão não foi concluída. Confira as permissões e tente novamente.")}</p>}
 {query.revoked&&<p role="status" className="mt-4">{t("Acesso ao CMS revogado no ReplaceAll. Seus sites e histórico foram preservados.")}</p>}
 <section className="ui-card mt-6 p-6"><h2 className="text-lg font-semibold">Webflow · {view.connections.length?t("Conectado"):t("Não conectado")}</h2><p className="mt-2 text-sm text-muted">{t("O acesso ao CMS fica salvo até ser revogado. Para incluir outro site ou workspace do Webflow, conecte e selecione as permissões desejadas.")}</p>
 {atSiteLimit && <p role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{t(quotaMessage("quota_sites")!)} {t("Você atingiu o limite de sites. Não é possível conectar outro site. Você ainda pode reconectar os sites existentes.")}</p>}
 {getWebflowConfig()?<form action={startWebflowConnection} className="mt-4 space-y-4"><input type="hidden" name="id" value={randomUUID()}/><input type="hidden" name="workspaceId" value={workspaceId}/><input type="hidden" name="confirmed" value="yes"/><p className="text-sm text-muted">{t("Os sites autorizados serão conectados automaticamente neste workspace.")} {view.name}</p><SubmitButton disabled={atSiteLimit && !view.sites.length} pendingLabel={t("Abrindo Webflow…")}>{t(atSiteLimit && view.sites.length ? "Reconectar Webflow" : "Conectar Webflow")}</SubmitButton></form>:<p>{t("Integração indisponível. Contate o administrador.")}</p>}
 {!!view.connections.length&&<ConfirmationDialog title={t("Revogar acesso ao CMS")} tone="danger"><form action={revokeWebflowAccess} className="mt-4 space-y-4"><input type="hidden" name="id" value={randomUUID()}/><input type="hidden" name="workspaceId" value={workspaceId}/>{view.connections.map(c=><input key={c.id} type="hidden" name="connection" value={c.id}/>)}<p className="text-sm">{t("Interrompe o acesso do ReplaceAll ao CMS neste workspace. Sites e histórico permanecem. Para remover também a autorização do aplicativo na sua conta, use as configurações de Apps do Webflow. O acesso ao Designer é independente e pode ser revogado abaixo.")}</p><label className="flex gap-2 text-sm"><input required type="checkbox" name="confirmed" value="yes"/>{t("Confirmo a revogação do acesso ao CMS de")} {view.name}.</label><SubmitButton pendingLabel={t("Revogando…")} variant="secondary">{t("Confirmar revogação")}</SubmitButton></form></ConfirmationDialog>}
 </section>
 <section className="ui-card mt-6 p-6"><h2 className="text-lg font-semibold">{t("Sites conectados")}</h2>
 {linkedSites.length ? <ul className="mt-4 space-y-3">{linkedSites.map(site=><li key={site.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><span className="font-medium">{site.display_name}</span><Link prefetch={false} className="ui-btn" href={site.href+"/overview"}>{t("Abrir site")}</Link></li>)}</ul> : <p className="mt-2 text-sm text-muted">{t("Nenhum site conectado neste workspace. Autorize os sites no Webflow para adicioná-los automaticamente.")}</p>}
 {query.error==="site-connection" && query.reason!=="quota_sites" && !!view.connections.length && <form action={retryWorkspaceConnection} className="mt-4"><input type="hidden" name="workspaceId" value={workspaceId}/><SubmitButton pendingLabel={t("Conectando…")}>{t("Tentar conexão novamente")}</SubmitButton></form>}
 </section>
 <section id="designer" className="mt-8"><h2 className="mb-4 text-xl font-semibold">{t("Extensão do Designer")}</h2><p className="mb-4 text-sm text-muted">{t("Autorize o acesso ao histórico e o registro de prévias por 30 dias. Alterações no site exigem confirmação no Designer.")}</p>
 {designer.length > 0 && <DataTable label={t("Extensão do Designer")}><thead><tr><th>{t("Site")}</th><th>Status</th><th>{t("Código de conexão")}</th><th>{t("Ações")}</th></tr></thead><tbody>{designer.map(v=><tr key={v.site.id}><td className="align-top"><Link className="block max-w-56 truncate font-semibold hover:underline" title={v.site.display_name} href={"/dashboard/sites/"+v.site.id+"/overview"}>{v.site.display_name}</Link></td><td className="align-top"><StatusBadge status={v.unavailable?"uncertain":v.sessions.length?"connected":"disconnected"} label={v.unavailable?t("Status indisponível"):v.sessions.length?t("Conectado"):t("Não conectado")}/></td><td className="align-top"><DesignerAuthorization id={randomUUID()} siteId={v.site.id} name={v.site.display_name}/></td><td className="align-top">{!!v.sessions.length&&<ConfirmationDialog title={t("Revogar acesso ao Designer")} tone="danger"><form action={revokeDesignerAccess} className="ui-card mt-3 space-y-4 p-5"><input type="hidden" name="siteId" value={v.site.id}/>{v.sessions.map(s=><input key={s.id} type="hidden" name="session" value={s.id}/>)}<p className="text-sm">{t("Interrompe todas as conexões atuais do Designer para este site. Uma alteração já enviada pode terminar.")}</p><label className="flex gap-2 text-sm"><input required type="checkbox" name="confirmed" value="yes"/>{t("Confirmo a revogação para")} {v.site.display_name}.</label><SubmitButton variant="secondary" pendingLabel={t("Revogando…")}>{t("Confirmar revogação")}</SubmitButton></form></ConfirmationDialog>}{!v.sessions.length&&<span className="text-muted">—</span>}</td></tr>)}</tbody></DataTable>}
 {!designer.length&&<p className="text-sm text-muted">{t("Conecte um site para autorizar sua extensão.")}</p>}</section></main>;
}
