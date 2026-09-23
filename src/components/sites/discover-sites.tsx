"use client";
import {useState,useTransition} from "react";
import {useText} from "@/i18n/use-text";
import {discoverWorkspaceSites} from "@/modules/sites/explorer-actions";
import {previewSiteConnection} from "@/modules/sites/actions";
import {SubmitButton} from "@/components/ui/submit-button";
export function DiscoverSites({workspaceId,linked}:{workspaceId:string;linked:string[]}) {
 const t=useText();const [pending,start]=useTransition();const [state,setState]=useState<(Awaited<ReturnType<typeof discoverWorkspaceSites>> & {ids:string[]})|null>(null);
 return <div className="mt-4"><button className="ui-btn" disabled={pending} onClick={()=>start(async()=>{try{const result=await discoverWorkspaceSites(workspaceId);setState({...result,ids:result.available.map(()=>crypto.randomUUID())});}catch{setState({available:[],failed:true,ids:[]});}})}>{pending?t("Carregando…"):t("Buscar sites disponíveis")}</button>
 {state?.failed&&<p role="alert">{t("Algumas permissões não puderam ser consultadas. Tente novamente ou reconecte o Webflow.")}</p>}
 {state&&!state.failed&&!state.available.length&&<p>{t("Nenhum site disponível nesta autorização.")}</p>}
 <ul className="mt-4 space-y-3">{state?.available.map((site,i)=><li key={site.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><span>{site.displayName}</span><form action={previewSiteConnection}><input type="hidden" name="id" value={state.ids[i]}/><input type="hidden" name="connectionId" value={site.connectionId}/><input type="hidden" name="siteId" value={site.id}/><SubmitButton pendingLabel={t("Preparando…")} variant="secondary">{linked.includes(site.id)?t("Revisar conexão"):t("Conectar site")}</SubmitButton></form></li>)}</ul>
 </div>;
}
