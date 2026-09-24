import { ImagePreview } from "./image-change-preview";
import type { Occurrence } from "@/modules/scans/schema";
import { ReviewedOccurrence } from "./reviewed-occurrence";
import Link from "next/link";
import { getText } from "@/i18n/server";
import { EmptyState } from "@/components/ui";
import { variableEvidence, CREATED_VARIABLES_PAGE_SIZE, type scanCreatedVariables } from "@/modules/scans/created-variables";

export async function CreatedVariables({view,page,href,siteId,occurrences,linkedValues}:{siteId:string;occurrences:Occurrence[];linkedValues:Record<string,{id:string}>;view:Awaited<ReturnType<typeof scanCreatedVariables>>;page:number;href:string}) {
 const t=await getText();
 const evidence=await Promise.all(view.values.map(value=>variableEvidence(siteId,value.id,occurrences)));
 return <section className="mt-6" aria-label={t("Variáveis criadas neste scan")}>
  <p className="mb-4 text-sm text-muted">{t("Variáveis deste scan e resultados da última operação registrada. A criação não significa que todas as fontes foram sincronizadas.")}</p>
  {!view.values.length ? <EmptyState title={t("Nenhuma variável criada neste scan")} description={t("Selecione pelo menos dois campos em Pendentes e escolha Criar variável e aplicar na prévia.")}/> : <div className="space-y-5">{view.values.map((value,index)=>{
   const saved=evidence[index];
   const rows=saved?.rows ?? occurrences.filter(row=>linkedValues[row.source_key]?.id===value.id);
   return <article key={value.id} className="ui-card p-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{value.name}</h2><p className="text-sm text-muted">{t(view.createdIds.includes(value.id)?"Variável criada neste scan":"Variável vinculada neste scan")} · {t(value.archived_at?"Arquivado":"Ativo")}</p></div><Link prefetch={false} href={view.links[value.id]!} className="ui-btn">{t("Abrir Variável")}</Link></header>
    {rows.map(row=>{
     const verified=saved?.history[row.id];
     const result=saved?.results.find(result=>result.sourceKey===row.source_key);
     return verified ? <ReviewedOccurrence key={row.id} occurrence={row} history={{...verified,reversible:false}} outcome={result}/> : <section key={row.id} className="mt-4 rounded-xl border p-5"><h3 className="font-semibold">{row.item_name}</h3><p className="text-sm text-muted">{row.collection_name} → {row.field_name}</p><p className="mt-2 text-sm">{t("Sem alteração verificada nesta operação.")}</p>{result && <p className="text-sm">{t(result.message)}</p>}{row.canonical.type === "image" ? <ImagePreview url={row.canonical.url} label={t("Valor original do scan")}/> : <p className="mt-3 break-words whitespace-pre-wrap">{row.source_value}</p>}</section>;
    })}
    {!rows.length && <p className="mt-4 text-sm text-muted">{t("Sem alteração verificada nesta operação.")}</p>}
   </article>;
  })}</div>}

  {view.total>CREATED_VARIABLES_PAGE_SIZE && <nav className="mt-4 flex gap-3" aria-label={t("Paginação")}>
   {page>1 && <Link className="ui-btn" href={href+"?filter=variables&page="+(page-1)}>{t("Anterior")}</Link>}
   {page*CREATED_VARIABLES_PAGE_SIZE<view.total && <Link className="ui-btn" href={href+"?filter=variables&page="+(page+1)}>{t("Próxima")}</Link>}
  </nav>}
 </section>;
}
