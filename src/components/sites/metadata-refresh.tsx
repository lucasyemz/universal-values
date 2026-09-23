"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useText } from "@/i18n/use-text";
import { refreshSiteMetadata } from "@/modules/sites/metadata-actions";
export function MetadataRefresh({siteId,kind='collections',collection='',fetchedAt=null}:{siteId:string;kind?:'site'|'collections'|'schema';collection?:string;fetchedAt?:string|null}) {
 const t=useText(), router=useRouter();const [pending,start]=useTransition();const [message,setMessage]=useState('');
 return <div className="my-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
  <span>{fetchedAt?t("Estrutura salva · atualizada em {0}",fetchedAt.replace('T',' ').slice(0,16)+' UTC'):t("Estrutura ainda não carregada")}</span>
  <button type="button" className="ui-btn ui-btn-secondary" disabled={pending} onClick={()=>start(async()=>{
   setMessage('');const result=await refreshSiteMetadata({siteId,kind,collection});
   if(result.ok) router.refresh();else setMessage(result.code==='rate_limit'?t("Aguarde {0} segundos antes de atualizar novamente.",result.retryAfter):t("Não foi possível atualizar. Confira a conexão nas configurações e tente novamente."));
  })}><RefreshCw size={14} className={pending?'animate-spin':''}/>{pending?t("Atualizando…"):t("Atualizar do Webflow")}</button>
  {message&&<span role="alert">{message}</span>}
 </div>;
}
