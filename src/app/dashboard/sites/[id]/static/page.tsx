import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("staticPages");
}

import { getText } from "@/i18n/server";
import { LegacySiteSection } from "@/components/sites/legacy-site-section";
import { designerSite } from "@/modules/static-text/dashboard-service";
import Link from "next/link";
import {SiteContext} from "@/components/layout/app-shell";
import {PageHeader,Notice} from "@/components/ui";
import {MetadataRefresh} from "@/components/sites/metadata-refresh";
import {readMetadata} from "@/modules/sites/metadata-service";
import {webflowDesignerUrl} from "@/connectors/webflow/designer-url";
import {workspaceLink} from "@/modules/routes/links";
import {ExternalLink} from "lucide-react";
export default async function StaticPage({params}: {params:Promise<{id:string}>}) {
  const t = await getText();

 const {id}=await params;const {site}=await designerSite(id);
 const metadata=await readMetadata(id,'site').catch(()=>null);
 const href=metadata?.data ? webflowDesignerUrl(metadata.data.site.shortName,process.env.WEBFLOW_CLIENT_ID) : null;
 const destination=(await workspaceLink(site.workspace_id)).replace(/sites$/,'settings/webflow')+'#designer';
 return <main className="ui-page">
  <SiteContext siteName={site.display_name} title={t("Scans estáticos")} siteId={id} workspaceId={site.workspace_id}/>
  <LegacySiteSection siteId={id} section="static"/>
  <PageHeader eyebrow={site.display_name} title={t("Scans estáticos")} description={t("Busque e edite páginas estáticas com a extensão ReplaceAll no Webflow.")}/>
  <section className="ui-card max-w-3xl space-y-5 p-6">
   <h2 className="text-lg font-semibold">{t("Comece em 3 passos")}</h2>
   <ol className="space-y-6">
    {[
     {title:"Abra o Webflow",description:"Use o botão abaixo para abrir seu projeto e escolha a página que deseja editar."},
     {title:"Abra o ReplaceAll em Apps",description:"Na barra lateral do Webflow, clique em Apps e abra o ReplaceAll. Se ele já estiver aberto, siga para o próximo passo."},
     {title:"Pesquise o que deseja mudar",description:"Escolha Texto, Links ou Imagens e faça sua busca. Selecione os resultados, revise a prévia e confirme as alterações na extensão."},
    ].map((step,index)=><li key={step.title} className="flex items-start gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent" aria-hidden="true">{index+1}</span><div className="min-w-0 space-y-2"><h3 className="font-semibold">{t(step.title)}</h3><p className="text-sm leading-6 text-muted">{t(step.description)}</p>{index===0 && (href ? <a href={href} target="_blank" rel="noopener noreferrer" className="ui-btn ui-btn-primary">{t("Abrir no Webflow")}<ExternalLink size={16}/></a> : <Notice>{t("Atualize os dados do site para obter o link do Designer.")}</Notice>)}</div></li>)}
   </ol>
   <MetadataRefresh siteId={id} kind="site" fetchedAt={metadata?.entry?.fetchedAt}/>
   <Link href={destination} className="text-sm text-accent hover:underline">{t("Abrir configurações do Webflow")}</Link>
  </section>
 </main>;
}
