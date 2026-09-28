"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useText } from "@/i18n/use-text";
import { loadManagedContext } from "@/modules/managed-values/context-actions";

/** Contextual scan shortcut uses the same dedicated editor as the Variables list. */
export function ManagedValueContext({ siteId, valueId, edit = false }: { siteId: string; valueId: string; edit?: boolean }) {
 const t=useText(),router=useRouter();
 const [loading,setLoading]=useState(false),[error,setError]=useState(false);
 async function open(){
  setLoading(true);setError(false);
  try{
   const view=await loadManagedContext({siteId,valueId,page:1});
   if(!view.ok){setError(true);return;}
   router.push(view.href+(edit&&!view.disabled?"#managed-editor":"#managed-sources"));
  }catch{setError(true);}finally{setLoading(false);}
 }
 return <span><button type="button" disabled={loading} className="ui-btn relative z-10 text-xs" onClick={()=>void open()}>{t(loading?"Carregando fontes…":edit?"Editar":"Ver fontes")}</button>{error&&<span role="alert" className="ml-2 text-xs text-muted">{t("Não foi possível carregar as fontes.")}</span>}</span>;
}
