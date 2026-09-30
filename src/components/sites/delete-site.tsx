"use client";
import { useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { deleteSiteHistory } from "@/modules/sites/delete-action";
import { useText } from "@/i18n/use-text";
export function DeleteSite({siteId,name,onOpen}:{siteId:string;name:string;onOpen?:()=>void}) {
 const t=useText(),router=useRouter(),id=useRef(""),[error,setError]=useState<string|null>(null),[busy,start]=useTransition();
 return <ConfirmationDialog portal title={t("Excluir projeto")} tone="danger" busy={busy} triggerClassName="ui-nav-link w-full text-left !text-red-600 hover:!bg-red-50" triggerIcon={<Trash2 size={17} aria-hidden="true"/>} onOpen={()=>{id.current ||= crypto.randomUUID();onOpen?.();}}>
 <p className="font-semibold">{name}</p>
 <p>{t("O projeto, scans, variáveis e histórico serão excluídos do ReplaceAll. O site no Webflow não será alterado. Os scans usados hoje continuam contando.")}</p>
 {error&&<p role="alert">{t(error)}</p>}
 <button type="button" className="ui-btn ui-btn-danger" disabled={busy} onClick={()=>start(async()=>{
 const form=new FormData();form.set("id",id.current);form.set("site",siteId);form.set("confirmed","yes");
 const result=await deleteSiteHistory(form);setError(result.error);if(!result.error)router.refresh();
 })}>{t(busy?"Excluindo…":"Excluir projeto e histórico")}</button>
 </ConfirmationDialog>;
}
