"use client";
import { ContentFreshness } from "./content-freshness";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useText } from "@/i18n/use-text";
import { refreshSiteMetadata } from "@/modules/sites/metadata-actions";
export function MetadataRefresh({siteId,kind='collections',collection='',fetchedAt=null,compact=false,onRefreshStart,onRateLimit,disabled=false}:{disabled?:boolean;onRateLimit?:(seconds:number)=>void;onRefreshStart?:()=>void;compact?:boolean;siteId:string;kind?:'site'|'collections'|'schema';collection?:string;fetchedAt?:string|null}) {
 const t=useText(), router=useRouter();const [pending,start]=useTransition();const [message,setMessage]=useState('');const [retryUntil,setRetryUntil]=useState(0);const [now,setNow]=useState(0);
 useEffect(()=>{if(!retryUntil)return;const timer=setInterval(()=>{const next=Date.now();setNow(next);if(next>=retryUntil)clearInterval(timer);},1000);return ()=>clearInterval(timer);},[retryUntil]);
 return <div className="my-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
  <span>{compact&&fetchedAt?<ContentFreshness structure fetchedAt={fetchedAt}/>:fetchedAt?t("Estrutura salva · atualizada em {0}",fetchedAt.replace('T',' ').slice(0,16)+' UTC'):t("Estrutura ainda não carregada")}</span>
  <button type="button" aria-label={t("Atualizar do Webflow")} title={t("Atualizar do Webflow")} className={compact?"rounded-lg border p-2 hover:bg-accent-soft":"ui-btn ui-btn-secondary"} disabled={pending||disabled||retryUntil>now} onClick={()=>start(async()=>{
   if(Date.now()<retryUntil)return;
   onRefreshStart?.();setMessage('');
   try {
   const result=await refreshSiteMetadata({siteId,kind,collection});
   if(result.code==='rate_limit'){const seconds=Math.max(1,result.retryAfter||60);setNow(Date.now());setRetryUntil(Date.now()+seconds*1000);onRateLimit?.(seconds);}
   if(result.ok) router.refresh();else setMessage(result.code==='rate_limit'?t("Aguarde {0} segundos antes de atualizar novamente.",result.retryAfter):t("Não foi possível atualizar. Confira a conexão nas configurações e tente novamente."));
   }catch{setMessage(t("Não foi possível atualizar. Confira a conexão nas configurações e tente novamente."));}
  })}><RefreshCw size={14} className={pending?'animate-spin':''}/>{!compact&&(pending?t("Atualizando…"):t("Atualizar do Webflow"))}</button>
  {message&&<span role="alert">{message}</span>}
 </div>;
}
