import { dashboardMetadata } from "@/modules/dashboard/metadata";
export async function generateMetadata(){return dashboardMetadata("cms");}
import {TabLink} from "@/components/ui/tab-link";
import {getText} from "@/i18n/server";
import {readMetadata} from "@/modules/sites/metadata-service";
import {MetadataRefresh} from "@/components/sites/metadata-refresh";
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
 <h2 className="text-lg font-semibold">{t("Estrutura em cache")}</h2>
 <MetadataRefresh siteId={id} fetchedAt={saved.entry?.fetchedAt}/>
 {saved.denied?<Notice tone="danger">{t("Confira as permissões nas configurações do Webflow.")}</Notice>:!saved.fresh&&<Notice>{t("A estrutura salva está ausente ou expirou. Atualize quando quiser preparar um scan.")}</Notice>}
 <nav className="ui-tabs" aria-label={t("Coleções")}>{saved.data?.collections?.map(c=><TabLink key={c.id} href={base+'?collection='+c.id} aria-current={selected?.id===c.id?'page':undefined} className="ui-tab">{c.displayName}</TabLink>)}</nav>
 {selected&&<section className="mt-6"><h2 className="text-xl font-semibold">{selected.displayName}</h2>
 <MetadataRefresh siteId={id} kind="schema" collection={selected.id} fetchedAt={schema?.entry?.fetchedAt}/>
 {schema?.data?.details&&<details className="ui-card p-4"><summary>{t("Campos da coleção (")}{schema.data.details.fields.length}){!schema.fresh?' · '+t("Expirado"):''}</summary><ul className="mt-3">{schema.data.details.fields.map(f=><li key={f.id}>{f.displayName} · {f.type}</li>)}</ul></details>}
 <LiveCmsItems key={id+selected.id} siteId={id} collectionId={selected.id} initialOffset={safeOffset(offset)}/></section>}
 {saved.data?.site.locales&&<details className="mt-4"><summary>{t("Idiomas do site")}</summary><p>{[saved.data.site.locales.primary,...saved.data.site.locales.secondary??[]].filter(Boolean).map(l=>l?.tag).join(', ')}</p></details>}
 </SitePage>;
}
