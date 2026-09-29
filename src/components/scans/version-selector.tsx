"use client";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useText } from "@/i18n/use-text";
import { scanVersions } from "@/modules/scans/version-actions";

export function ScanVersionSelector({id,version}:{id:string;version:number}) {
 const t=useText();
 const popupId=useId(), trigger=useRef<HTMLButtonElement>(null), panel=useRef<HTMLDivElement>(null);
 const [position,setPosition]=useState<CSSProperties>({});
 const close=()=>panel.current?.hidePopover();
 function place(){
  const rect=trigger.current?.getBoundingClientRect(); if(!rect)return;
  const width=Math.min(288,window.innerWidth-24), above=rect.top>window.innerHeight-rect.bottom;
  setPosition({position:"fixed",margin:0,width,left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),top:above?"auto":rect.bottom+8,bottom:above?window.innerHeight-rect.top+8:"auto",maxHeight:Math.max(80,(above?rect.top:window.innerHeight-rect.bottom)-20)});
 }
 useEffect(()=>{
  const hide=(event:Event)=>{if(event.target instanceof Node && panel.current?.contains(event.target))return;panel.current?.hidePopover();};
  window.addEventListener("resize",hide);window.addEventListener("wheel",hide,true);
  return()=>{window.removeEventListener("resize",hide);window.removeEventListener("wheel",hide,true);};
 },[]);
 const [open,setOpen]=useState(false),[page,setPage]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 const [data,setData]=useState<Awaited<ReturnType<typeof scanVersions>>>();
 async function load(next:number){setBusy(true);setError(false);try{setData(await scanVersions({id,page:next}));setPage(next);}catch{setError(true);}finally{setBusy(false);}}
 return <div className="relative shrink-0">
  <button ref={trigger} popoverTarget={popupId} aria-controls={popupId} type="button" className="ui-touch-target inline-flex items-center gap-1 rounded-lg border bg-white px-2 py-1 text-xs font-medium text-accent" aria-expanded={open} aria-label={t("Versões do scan")} onClick={()=>{place();if(!open&&!data&&!busy)void load(1);}}>V{version}<ChevronDown size={13}/></button>
  <div ref={panel} id={popupId} popover="auto" style={position} onToggle={event=>setOpen(event.newState==="open")} className="overflow-y-auto rounded-xl border bg-surface p-3 shadow-lg">
   <div className="mb-2 flex items-center justify-between"><strong className="text-sm">{t("Versões do scan")}</strong><button type="button" className="ui-touch-target px-2 text-xs underline" onClick={()=>{close();trigger.current?.focus();}}>{t("Fechar")}</button></div>
   {busy?<p role="status" className="text-xs">{t("Carregando…")}</p>:error?<button type="button" className="ui-btn" onClick={()=>void load(page)}>{t("Tentar novamente")}</button>:<><ul className="max-h-64 space-y-1 overflow-y-auto">{data?.rows.map(row=><li key={row.id}><Link prefetch={false} aria-current={row.id===id?'page':undefined} className="block rounded-lg px-2 py-2 text-sm hover:bg-accent-soft aria-[current=page]:bg-accent-soft" href={row.href} onClick={close}>V{row.scan_version} · {t(row.is_latest?"Mais recente":"Somente leitura")}<span className="mt-1 block text-xs text-muted">{new Date(row.created_at).toLocaleString(t.dateLocale)}</span></Link></li>)}</ul><div className="mt-2 flex justify-between gap-2"><button type="button" disabled={page===1} className="ui-touch-target px-2 text-xs disabled:opacity-40" onClick={()=>void load(page-1)}>{t("Anterior")}</button><button type="button" disabled={!data?.more} className="ui-touch-target px-2 text-xs disabled:opacity-40" onClick={()=>void load(page+1)}>{t("Próxima")}</button></div></>}
  </div>
 </div>;
}
