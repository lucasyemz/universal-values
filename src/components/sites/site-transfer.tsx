"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useText } from "@/i18n/use-text";
import { transferTargets, prepareSiteTransfer, applySiteTransfer } from "@/modules/sites/transfer-actions";

export function SiteTransfer({siteId,name,onClose}:{siteId:string;name:string;onClose:()=>void}) {
 const t=useText(),router=useRouter(),dialog=useRef<HTMLDialogElement>(null);
 const [targets,setTargets]=useState<{id:string;name:string}[]|null>(null),[target,setTarget]=useState("");
 const [preview,setPreview]=useState<{id:string;name:string;from:string;to:string}|null>(null);
 const [error,setError]=useState(""),[settings,setSettings]=useState(""),[busy,start]=useTransition();
 useEffect(()=>{dialog.current?.showModal();let active=true;transferTargets(siteId).then(rows=>{if(active)setTargets(rows);}).catch(()=>{if(active)setError("Transfer unavailable");});return()=>{active=false;};},[siteId]);
 const submit=()=>start(async()=>{
  setError("");setSettings("");
  try {
   if(preview){const result=await applySiteTransfer({id:preview.id,confirmed:true});if(result.href){router.push(result.href);router.refresh();onClose();}else setError(result.error??"Transfer unavailable");}
   else {const result=await prepareSiteTransfer({id:crypto.randomUUID(),site:siteId,target});if(result.preview)setPreview(result.preview);else {setError(result.error??"Transfer unavailable");setSettings(result.settings??"");}}
  }catch{setError("Transfer unavailable");}
 });
 return <dialog ref={dialog} onCancel={event=>{if(busy)event.preventDefault();}} onClose={onClose} aria-labelledby={`transfer-${siteId}`} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border bg-white p-6 text-ink shadow-xl backdrop:bg-slate-900/30">
  <div className="flex items-start justify-between gap-4"><h2 id={`transfer-${siteId}`} className="text-lg font-semibold">{t("Transfer site")}</h2><button type="button" disabled={busy} onClick={onClose} className="ui-btn p-2" aria-label={t("Fechar")}><X size={18}/></button></div>
  <p className="mt-2 break-words font-medium">{name}</p>
  <p className="my-4 text-sm text-muted">{t("Move this site between your CopyReplace workspaces. This does not transfer the project in Webflow.")}</p>
  {preview?<><p className="rounded-xl border bg-subtle p-4 break-words">{preview.from} → <strong>{preview.to}</strong></p><p className="mt-3 text-sm">{t("History, scans and Managed Values move with the site. Destination workspace members will have access. Pending previews expire and the Designer extension must reconnect.")}</p></>:targets===null?<p role="status">{t("Carregando…")}</p>:targets.length===0?<p>{t("Create another workspace to transfer this site.")}</p>:<label className="block text-sm font-medium">{t("Destination workspace")}<select className="ui-input mt-2 w-full" value={target} disabled={busy} onChange={e=>{setTarget(e.target.value);setError("");setSettings("");}}><option value="">{t("Selecione")}</option>{targets.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
  {error&&<p role="alert" className="mt-4 text-sm text-red-700">{t(error)}</p>}
  {settings&&<Link href={settings} prefetch={false} className="ui-btn mt-3">{t("Configurações do Webflow")}</Link>}
  <div className="mt-6 flex justify-end gap-2"><button type="button" disabled={busy} className="ui-btn" onClick={()=>preview?setPreview(null):onClose()}>{t(preview?"Voltar":"Cancelar")}</button><button type="button" disabled={busy||!target} className="ui-btn ui-btn-primary" onClick={submit}>{t(busy?"Processando…":preview?"Confirm transfer":"Revisar")}</button></div>
 </dialog>;
}
