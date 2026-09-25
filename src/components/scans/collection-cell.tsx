"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useText } from "@/i18n/use-text";
import Link from "next/link";
import type { Scan } from "@/modules/scans/schema";

export function ScanCollectionCell({scan,href}:{scan:Pick<Scan,"plan">;href?:string}) {
  const t=useText();
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const popupId=useId();
  const [first,...others]=scan.plan;
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);trigger.current?.focus();}};
    document.addEventListener("pointerdown",outside);
    document.addEventListener("keydown",escape);
    return ()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};
  },[open]);
  if(!first)return null;
  return <div ref={root} className="relative flex min-w-0 max-w-xs items-center gap-1.5" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
    {href ? <Link prefetch={false} href={href} title={first.name} className="relative z-10 min-w-0 truncate rounded-md border bg-subtle px-2 py-0.5 text-xs font-medium text-muted focus-visible:outline-2 focus-visible:outline-accent">{first.name}</Link> : <span title={first.name} className="min-w-0 truncate rounded-md border bg-subtle px-2 py-0.5 text-xs font-medium text-muted">{first.name}</span>}
    {others.length>0 && <>
      <button ref={trigger} type="button" aria-expanded={open} aria-controls={popupId} aria-label={t("Ver mais {0} coleções",others.length)} onClick={()=>setOpen(value=>!value)} className="relative z-10 shrink-0 rounded-md border bg-subtle px-2 py-0.5 text-xs font-medium text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent">+{others.length}</button>
      {open && <div id={popupId} className="absolute left-0 top-full z-30 mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-xl border bg-white p-3 shadow-lg">
        <p className="mb-2 text-xs font-semibold text-muted">{t("Outras coleções")}</p>
        <ul className="max-h-60 space-y-2 overflow-y-auto">{others.map(collection=><li key={collection.id} className="break-words text-sm">{collection.name}</li>)}</ul>
      </div>}
    </>}
  </div>;
}
