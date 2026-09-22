"use client";
import { useState } from "react";
import { useText } from "@/i18n/use-text";
import { prepareInlineRevert } from "@/modules/scans/revert-inline-actions";
import { InlineReview } from "./inline-review";
export function InlineRevert({requestId,sources}:{requestId:string;sources:string[]}) {
 const t=useText();
 const [open,setOpen]=useState(false),[locked,setLocked]=useState(false);
 return <div className="mt-4">
  <button type="button" className="ui-btn" disabled={locked} onClick={()=>setOpen(!open)}>{t(open?"Fechar prévia de reversão":sources.length===1?"Reverter este campo":"Reverter {0} campos visíveis desta operação",sources.length)}</button>
  {open && <><p className="mt-2 text-sm text-muted">{t("A reversão restaura o campo inteiro desta operação, incluindo outros trechos alterados nele. Confira a prévia antes de confirmar.")}</p><InlineReview reverting draftKey={JSON.stringify({requestId,sources})} prepare={id=>prepareInlineRevert({id,originalId:requestId,sources})} onConfirmingChange={setLocked}/></>}
 </div>;
}
