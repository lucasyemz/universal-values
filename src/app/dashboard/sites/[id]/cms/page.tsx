import { dashboardMetadata } from "@/modules/dashboard/metadata";
export async function generateMetadata(){return dashboardMetadata("cms");}
import {metadataExplorerScope,explorerScopeKey} from "@/modules/sites/explorer-scope";
import {getText} from "@/i18n/server";
import {readMetadata} from "@/modules/sites/metadata-service";

import {LiveCmsItems} from "@/components/sites/live-cms-items";
import {SitePage} from "@/components/sites/site-page";
import {Notice} from "@/components/ui";
import {safeOffset} from "@/modules/sites/schema";
import {siteLink} from "@/modules/routes/links";
export default async function CmsPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{collection?:string;offset?:string}>}) {
 const {id}=await params,{collection,offset}=await searchParams,t=await getText();
 const saved=await readMetadata(id,'collections'),base=(await siteLink(id))+'/cms';
 const selected=saved.data?.collections?.find(c=>c.id===collection);
 const schema=selected?await readMetadata(id,'schema',selected.id):null;
 return <SitePage site={saved.site} newScan newScanHref={base.replace(/\/cms$/,'/scans/new')} title={t("Explorar CMS")} description={t("Estrutura salva; conteúdo consultado sob demanda.")}>
 {saved.denied?<Notice tone="danger">{t("Confira as permissões nas configurações do Webflow.")}</Notice>:<LiveCmsItems key={explorerScopeKey(metadataExplorerScope(saved))+(saved.entry?.fetchedAt??"")+(schema?.entry?.fetchedAt??"")} scope={metadataExplorerScope(saved)} collections={saved.data?.collections??[]} initialCollection={selected?.id} initialDetails={schema?.data?.details??null} fetchedAt={saved.entry?.fetchedAt??null} fresh={saved.fresh} localeLabels={Object.fromEntries([saved.data?.site.locales?.primary,...saved.data?.site.locales?.secondary??[]].flatMap(locale=>locale?[[locale.cmsLocaleId,locale.tag]]:[]))} initialOffset={safeOffset(offset)}/>}
 {saved.data?.site.locales&&<details className="mt-4"><summary>{t("Idiomas do site")}</summary><p>{[saved.data.site.locales.primary,...saved.data.site.locales.secondary??[]].filter(Boolean).map(l=>l?.tag).join(', ')}</p></details>}
 </SitePage>;
}
