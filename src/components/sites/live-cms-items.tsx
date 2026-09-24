"use client";
import {useState,useRef,useEffect,useCallback} from "react";
import {useText} from "@/i18n/use-text";
import {ContentFreshness} from "./content-freshness";
import {filterExplorerItems,explorerItemDate} from "@/modules/sites/explorer-presentation";
import {ExplorerSession} from "@/modules/sites/explorer-session";
import {MetadataRefresh} from "./metadata-refresh";
import type {ExplorerScope} from "@/modules/sites/explorer-scope";
import type {z} from "zod";
import type {collectionSchema,collectionDetailsSchema} from "@/connectors/webflow/schemas";
import {loadLiveCms,explorerStructure} from "@/modules/sites/explorer-actions";
import {StatusBadge,EmptyState,DataTable} from "@/components/ui";
type Success=Extract<Awaited<ReturnType<typeof loadLiveCms>>,{ok:true}>;
export function LiveCmsItems({scope,collections,initialCollection,initialDetails,fetchedAt,fresh,localeLabels={},initialOffset=0}:{localeLabels?:Record<string,string>;scope:ExplorerScope;collections:z.infer<typeof collectionSchema>[];initialCollection?:string;initialDetails:z.infer<typeof collectionDetailsSchema>|null;fetchedAt:string|null;fresh:boolean;initialOffset?:number}) {
 const t=useText();
 const [collectionId,setCollectionId]=useState(initialCollection??'');
 const [details,setDetails]=useState(initialDetails);
 const [result,setResult]=useState<Success|null>(null);
 const [error,setError]=useState('');
 const [pending,setPending]=useState(false);
 const [query,setQuery]=useState('');
 const [offset,setOffset]=useState(initialOffset);
 const [retryUntil,setRetryUntil]=useState(0);
 const [clock,setClock]=useState(0);
 useEffect(()=>{if(!retryUntil)return;const timer=setInterval(()=>{const now=Date.now();setClock(now);if(now>=retryUntil)clearInterval(timer);},1000);return ()=>clearInterval(timer);},[retryUntil]);
 const cooldown=Math.max(0,Math.ceil((retryUntil-clock)/1000));
 const rateLimit=useCallback((seconds:number)=>{const now=Date.now();setClock(now);setRetryUntil(now+seconds*1000);},[]);
 const sequence=useRef(0);
 const [session]=useState(()=>new ExplorerSession<Awaited<ReturnType<typeof loadLiveCms>>>());
 useEffect(()=>()=>{sequence.current++;session.clear();},[session]);
 const clear=()=>{sequence.current++;session.clear();setResult(null);setPending(false);setError('');};
 const load=async(offset:number,selected=collectionId)=>{
  if(!selected||cooldown>0)return;
  const current=++sequence.current;
  if(selected!==collectionId)setQuery('');
  setOffset(offset);setCollectionId(selected);setResult(null);setDetails(null);setError('');setPending(true);
  const url=new URL(window.location.href);url.searchParams.set('collection',selected);url.searchParams.set('offset',String(offset));window.history.replaceState(null,'',url.pathname+url.search);
  try {
   await new Promise(resolve=>setTimeout(resolve,300));
   if(sequence.current!==current)return;
   const structure=await explorerStructure({scope,collectionId:selected});
   if(sequence.current!==current)return;
   if(!structure.ok){session.clear();setError(t("Não foi possível carregar os itens. Confira o acesso ao Webflow."));return;}
   setDetails(structure.details);
   const next=await session.load({scope,collectionId:selected,offset,locale:'',structureVersion:structure.fetchedAt},()=>loadLiveCms({scope,siteId:scope.siteId,collectionId:selected,offset}),value=>value.ok);
   if(sequence.current!==current)return;
   if(next.ok){setResult(next);setDetails(next.view.details);}else {
    session.clear();if(next.retryAfter)rateLimit(next.retryAfter);
    setError(t("Não foi possível carregar os itens mais recentes."));
   }
  }catch{if(sequence.current===current)setError(t("Não foi possível carregar os itens. Confira o acesso ao Webflow."));}
  finally{if(sequence.current===current)setPending(false);}
 };
 const view=result?.view;
 return <section>
 <MetadataRefresh disabled={pending||cooldown>0} onRateLimit={rateLimit} onRefreshStart={clear} compact siteId={scope.siteId} kind={collectionId?'schema':'collections'} collection={collectionId} fetchedAt={fetchedAt}/>
 {!fresh&&<p className="mb-3 text-xs text-muted">{t("Atualização recomendada")}</p>}
 <nav className="ui-tabs flex-wrap" aria-label={t("Coleções")}>{collections.map(collection=><button type="button" disabled={cooldown>0} key={collection.id} className="ui-tab" aria-pressed={collectionId===collection.id} onClick={()=>void load(0,collection.id)}>{collection.displayName}</button>)}</nav>
 {!collectionId&&<p className="my-6 text-sm text-muted">{t("Selecione uma coleção para ver os itens.")}</p>}
 {collectionId&&<div className="mt-6 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{collections.find(collection=>collection.id===collectionId)?.displayName}</h2>{details&&<details className="relative text-sm"><summary className="cursor-pointer">{t("Campos da coleção (")}{details.fields.length})</summary><ul className="absolute right-0 z-20 mt-2 max-h-72 w-72 overflow-auto rounded-xl border bg-white p-4 shadow-sm">{details.fields.map(field=><li key={field.id} className="py-1">{field.displayName} · {field.type}</li>)}</ul></details>}</div>}
 {pending&&<div role="status" aria-live="polite" className="mt-5 space-y-3"><p className="text-sm text-muted">{t("Carregando os itens mais recentes…")}</p>{Array.from({length:5},(_,index)=><div key={index} aria-hidden="true" className="h-12 animate-pulse rounded-lg bg-subtle motion-reduce:animate-none"/>)}</div>}
 {collectionId&&!pending&&!result&&!error&&<p className="my-6 text-sm text-muted">{t("Selecione a coleção acima para consultar os itens.")}</p>}
 {result&&<p className="mt-3 text-xs text-muted"><ContentFreshness fetchedAt={result.fetchedAt}/></p>}
 {cooldown>0&&<p role="status" className="mt-3 text-sm">{t("Aguarde {0} segundos antes de atualizar novamente.",cooldown)}</p>}
 {error&&<div role="alert" className="mt-4"><p>{error}</p><button className="ui-btn mt-2" disabled={pending||cooldown>0} onClick={()=>void load(offset)}>{t("Tentar novamente")}</button></div>}
     {view?.details && view.page && <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3"><label className="block min-w-0 sm:w-80"><span className="sr-only">{t("Pesquisar nesta página")}</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={t("Pesquisar nesta página")} className="w-full"/></label><p className="text-sm text-muted">{t("Mostrando {0}–{1} de {2}",view.page.items.length?view.page.pagination.offset+1:0,view.page.pagination.offset+view.page.items.length,view.page.pagination.total)}</p></div>
      {query&&<p className="mt-2 text-xs text-muted">{t("{0} resultados nesta página",filterExplorerItems(view.page.items,query).length)}</p>}
      {!view.page.items.length && <EmptyState title={t("Nenhum item nesta página")} description={t("Escolha outra coleção ou volte à primeira página.")} action={view.page.pagination.offset > 0 ? <button className="ui-btn" disabled={pending||cooldown>0} onClick={()=>load(0)}>{t("Primeira página")}</button> : undefined} /> }
      <div className="mt-4"><DataTable label={t("Itens do CMS")}><thead><tr><th>Item</th><th>{t("Estado")}</th><th>{t("Atualizado")}</th><th>{t("Conteúdo")}</th></tr></thead><tbody>{filterExplorerItems(view.page.items,query).map((item) => <tr key={item.id + ":" + (item.cmsLocaleId ?? "")}>
        <td className="min-w-44 align-top"><h3 className="font-semibold">{typeof item.fieldData.name === "string" ? item.fieldData.name : item.id}</h3>{item.cmsLocaleId && localeLabels[item.cmsLocaleId] && <p className="mt-2 text-xs text-muted">{localeLabels[item.cmsLocaleId]}</p>}</td>
        <td className="align-top"><StatusBadge status={item.isDraft ? "draft" : "ready"} label={item.isDraft ? t("Rascunho") : t("Preparado")} />{item.isArchived && <p className="mt-2 text-xs text-muted">{t("Arquivado")}</p>}</td>
        <td className="whitespace-nowrap align-top text-sm text-muted">{explorerItemDate(item.lastUpdated,t.dateLocale)}</td>
        <td className="min-w-64"><details><summary className="font-medium text-accent">{t("Ver campos do item")}</summary><dl className="mt-4 space-y-4">{Object.entries(item.fieldData).map(([field, value]) => <div key={field}><dt className="text-xs font-semibold text-muted">{view.details!.fields.find((f) => f.slug === field)?.displayName ?? field}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{typeof value === "string" || typeof value === "number" ? String(value) : typeof value === "boolean" ? t(value ? "Sim" : "Não") : value === null ? t("Não informado") : <details><summary className="text-xs text-muted">{t("Ver dados estruturados")}</summary><pre className="mt-2 whitespace-pre-wrap break-all text-xs">{JSON.stringify(value, null, 2)}</pre></details>}</dd></div>)}</dl></details></td>
      </tr>)}</tbody></DataTable></div>
      <nav aria-label={t("Paginação de itens")} className="mt-6 flex gap-6">
        {view.page.pagination.offset > 0 && <button className="ui-btn" disabled={pending||cooldown>0} onClick={()=>load(Math.max(0,view.page!.pagination.offset-25))}>{t("Anterior")}</button>}
        {view.page.pagination.offset + view.page.pagination.limit < view.page.pagination.total && <button className="ui-btn" disabled={pending||cooldown>0} onClick={()=>load(view.page!.pagination.offset+view.page!.pagination.limit)}>{t("Próxima")}</button>}
      </nav>
    </section>}
 </section>;
}
