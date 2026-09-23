"use client";
import {useState,useTransition} from "react";
import {useText} from "@/i18n/use-text";
import {loadLiveCms} from "@/modules/sites/explorer-actions";
import {StatusBadge,EmptyState,DataTable} from "@/components/ui";
type Success=Extract<Awaited<ReturnType<typeof loadLiveCms>>,{ok:true}>;
export function LiveCmsItems({siteId,collectionId,initialOffset=0}:{siteId:string;collectionId:string;initialOffset?:number}) {
 const t=useText();const [result,setResult]=useState<Success|null>(null);const [error,setError]=useState('');const [pending,start]=useTransition();
 const load=(offset:number)=>start(async()=>{setError('');const next=await loadLiveCms({siteId,collectionId,offset});if(next.ok){setResult(next);const url=new URL(window.location.href);url.searchParams.set("offset",String(offset));window.history.replaceState(null,"",url.pathname+url.search);}else{setResult(null);setError(next.retryAfter?t("Aguarde {0} segundos antes de atualizar novamente.",next.retryAfter):t("Não foi possível carregar os itens. Confira o acesso ao Webflow."));}});
 const view=result?.view;
 return <section className="mt-8"><h2 className="text-lg font-semibold">{t("Conteúdo ao vivo")}</h2>
 <p className="my-3 text-sm text-muted">{t("Os itens só são consultados quando você carrega ou muda a página abaixo. Rascunhos podem aparecer.")}</p>
 <button className="ui-btn ui-btn-secondary" disabled={pending} onClick={()=>load(result?.view.page?.pagination.offset??initialOffset)}>{pending?t("Carregando…"):t("Carregar itens do Webflow")}</button>
 {result&&<p className="mt-3 text-sm">{t("Consultado em {0}",result.fetchedAt.replace('T',' ').slice(0,19)+' UTC')}</p>}
 {error&&<p role="alert" className="mt-3">{error}</p>}
     {view?.details && view.page && <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight">{view.details.displayName}</h2>
      <p className="mt-6 text-sm text-muted">{view.page.pagination.total}  {t("itens · mostrando")} {view.page.items.length}  {t("nesta página.")}</p>
      {!view.page.items.length && <EmptyState title={t("Nenhum item nesta página")} description={t("Escolha outra coleção ou volte à primeira página.")} action={view.page.pagination.offset > 0 ? <button className="ui-btn" disabled={pending} onClick={()=>load(0)}>{t("Primeira página")}</button> : undefined} /> }
      <div className="mt-4"><DataTable label={t("Itens do CMS")}><thead><tr><th>Item</th><th>{t("Estado")}</th><th>{t("Conteúdo")}</th></tr></thead><tbody>{view.page.items.map((item) => <tr key={item.id + ":" + (item.cmsLocaleId ?? "")}>
        <td className="min-w-44 align-top"><h3 className="font-semibold">{typeof item.fieldData.name === "string" ? item.fieldData.name : item.id}</h3>{item.cmsLocaleId && <p className="mt-2 break-all text-xs text-muted">Locale: {item.cmsLocaleId}</p>}</td>
        <td className="align-top"><StatusBadge status={item.isDraft ? "draft" : "ready"} label={item.isDraft ? t("Rascunho") : t("Preparado")} />{item.isArchived && <p className="mt-2 text-xs text-muted">{t("Arquivado")}</p>}</td>
        <td className="min-w-64"><details><summary className="font-medium text-accent">{t("Ver campos do item")}</summary><dl className="mt-4 space-y-4">{Object.entries(item.fieldData).map(([field, value]) => <div key={field}><dt className="text-xs font-semibold text-muted">{view.details!.fields.find((f) => f.slug === field)?.displayName ?? field}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{typeof value === "string" || typeof value === "number" ? String(value) : typeof value === "boolean" ? t(value ? "Sim" : "Não") : value === null ? t("Não informado") : <details><summary className="text-xs text-muted">{t("Ver dados estruturados")}</summary><pre className="mt-2 whitespace-pre-wrap break-all text-xs">{JSON.stringify(value, null, 2)}</pre></details>}</dd></div>)}</dl></details></td>
      </tr>)}</tbody></DataTable></div>
      <nav aria-label={t("Paginação de itens")} className="mt-6 flex gap-6">
        {view.page.pagination.offset > 0 && <button className="ui-btn" disabled={pending} onClick={()=>load(Math.max(0,view.page!.pagination.offset-25))}>{t("Anterior")}</button>}
        {view.page.pagination.offset + view.page.pagination.limit < view.page.pagination.total && <button className="ui-btn" disabled={pending} onClick={()=>load(view.page!.pagination.offset+view.page!.pagination.limit)}>{t("Próxima")}</button>}
      </nav>
    </section>}
 </section>;
}
