"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRightLeft, ExternalLink, Globe2, History, Layers3, MoreHorizontal, ScanLine, Settings } from "lucide-react";
import { useText } from "@/i18n/use-text";
import { StatusBadge } from "@/components/ui";
import { MetadataRefresh } from "./metadata-refresh";
import { SiteTransfer } from "./site-transfer";

export function SiteCard({ siteId,settings,fetchedAt,name, href, url, image, connected }: { siteId:string;settings:string;fetchedAt:string|null;name: string; href: string; url: string | null; image: string | null; connected: boolean }) {
 const t=useText(),id=useId(),panel=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const [failedImage,setFailedImage]=useState<string|null>(null),[open,setOpen]=useState(false),[transfer,setTransfer]=useState(false),[position,setPosition]=useState<CSSProperties>({});
 useEffect(()=>{if(!open)return;const hide=()=>panel.current?.hidePopover();const scroll=(e:Event)=>{if(e.target instanceof Node&&panel.current?.contains(e.target))return;hide();};window.addEventListener("resize",hide);window.addEventListener("scroll",scroll,true);return()=>{window.removeEventListener("resize",hide);window.removeEventListener("scroll",scroll,true);};},[open]);
 const base=href.replace(/\/overview$/,"");
 const links=[{href, label:t("Visão geral do site"),Icon:Globe2},{href:base+"/scans",label:t("Scans"),Icon:ScanLine},{href:base+"/managed-values",label:t("Managed Values"),Icon:Layers3},{href:base+"/changes",label:t("Alterações"),Icon:History},{href:base+"/cms",label:t("Explorar CMS"),Icon:Globe2},{href:settings,label:t("Configurações do Webflow"),Icon:Settings}];
 const place=()=>{const rect=trigger.current?.getBoundingClientRect();if(!rect)return;const width=Math.min(264,window.innerWidth-24);const top=Math.max(12,Math.min(rect.bottom+6,window.innerHeight-520));setPosition({position:"fixed",margin:0,width,left:Math.max(12,Math.min(rect.right-width,window.innerWidth-width-12)),top,maxHeight:window.innerHeight-top-12});};
 return <article className="site-project-card !gap-0 !overflow-hidden !p-0 transition-shadow hover:shadow-md">
  <Link href={href} prefetch={false} aria-label={t("Entrar no site {0}",name)} className="block bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
   {image&&failedImage!==image?
    // Only the provider thumbnail, never an embedded customer page.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt={t("Prévia de {0}",name)} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailedImage(image)} className="site-project-image"/>:
    <div className="site-project-placeholder"><Globe2 size={32} aria-hidden="true" className="text-accent"/><span className="mt-2 text-xs text-muted">{t("Prévia do site indisponível")}</span></div>}
  </Link>
  <div className="space-y-3 border-t p-4">
   <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold" title={name}><Link href={href} prefetch={false} className="rounded hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">{name}</Link></h2>{url?<a href={url} target="_blank" rel="noopener noreferrer" title={url} className="mt-1 inline-flex max-w-full items-center gap-1 text-sm text-muted hover:text-accent hover:underline"><span className="truncate">{url.replace(/^https?:\/\//,"").replace(/\/$/,"")}</span><ExternalLink size={12} className="shrink-0" aria-hidden="true"/><span className="sr-only">{t("(abre em nova aba)")}</span></a>:<p className="mt-1 text-sm text-muted">{t("URL indisponível")}</p>}</div>
    <button ref={trigger} type="button" popoverTarget={id} onClick={place} aria-expanded={open} aria-controls={id} aria-label={t("Site options: {0}",name)} className="ui-btn h-9 w-9 shrink-0 !p-0"><MoreHorizontal size={20}/></button>
   </div>
   <StatusBadge status={connected?"connected":"disconnected"}/>
  </div>
  <div ref={panel} id={id} popover="auto" style={position} onToggle={e=>setOpen(e.newState==="open")} className="overflow-y-auto rounded-xl border bg-white p-1.5 text-ink shadow-lg">
   <nav aria-label={t("Site options: {0}",name)}>{links.map(({href,label,Icon})=><Link key={href} href={href} prefetch={false} onClick={()=>panel.current?.hidePopover()} className="ui-nav-link"><Icon size={17} aria-hidden="true"/>{label}</Link>)}</nav>
   <div className="mt-1 border-t px-2"><MetadataRefresh siteId={siteId} kind="site" fetchedAt={fetchedAt}/></div>
   <div className="mt-1 border-t pt-1"><button type="button" className="ui-nav-link w-full text-left" onClick={()=>{panel.current?.hidePopover();setTransfer(true);}}><ArrowRightLeft size={17} aria-hidden="true"/>{t("Transfer site")}</button></div>
  </div>
  {transfer&&<SiteTransfer siteId={siteId} name={name} onClose={()=>{setTransfer(false);trigger.current?.focus();}}/>}
 </article>;
}
