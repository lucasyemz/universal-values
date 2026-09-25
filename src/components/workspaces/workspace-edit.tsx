"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { MoreHorizontal, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useText } from "@/i18n/use-text";
import { applyWorkspaceEdit, prepareWorkspaceEdit } from "@/modules/workspaces/edit-actions";
import type { WorkspaceEditPreview } from "@/modules/workspaces/edit";

export function WorkspaceEdit({workspace}:{workspace:{id:string;name:string;slug:string}}) {
 const t=useText(),[open,setOpen]=useState(false),menu=useRef<HTMLDetailsElement>(null);
 return <><details ref={menu} className="relative shrink-0"><summary className="ui-btn list-none rounded-full p-2.5 [&::-webkit-details-marker]:hidden" aria-label={`${t("Opções do workspace")}: ${workspace.name}`}><MoreHorizontal size={18}/></summary><div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border bg-white p-2 shadow-lg"><button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-subtle" onClick={()=>{if(menu.current)menu.current.open=false;setOpen(true);}}><Pencil size={16}/>{t("Editar workspace")}</button></div></details>{open&&<WorkspaceEditDialog workspace={workspace} onClose={()=>setOpen(false)}/>}</>;
}
function WorkspaceEditDialog({workspace,onClose}:{workspace:{id:string;name:string;slug:string};onClose:()=>void}) {
 const t=useText(),router=useRouter(),dialog=useRef<HTMLDialogElement>(null);
 const [name,setName]=useState(workspace.name),[slug,setSlug]=useState(workspace.slug),[preview,setPreview]=useState<WorkspaceEditPreview|null>(null),[error,setError]=useState(""),[busy,start]=useTransition();
 useEffect(()=>{dialog.current?.showModal();},[]);
 const submit=()=>start(async()=>{
  setError("");
  try{
   if(preview){const result=await applyWorkspaceEdit({id:preview.id,confirmed:true});if(result.success){router.refresh();onClose();}else setError(result.error??"");}
   else {const result=await prepareWorkspaceEdit({id:crypto.randomUUID(),workspace:workspace.id,name,slug});if(result.preview)setPreview(result.preview);else setError(result.error??"");}
  }catch{setError("Não foi possível editar o workspace. Atualize a página e tente novamente.");}
 });
 return <dialog ref={dialog} onCancel={e=>{if(busy)e.preventDefault();}} onClose={onClose} aria-labelledby="workspace-edit-title" className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border bg-white p-6 text-ink shadow-xl backdrop:bg-slate-900/30">
  <div className="flex items-center justify-between gap-4"><h2 id="workspace-edit-title" className="text-lg font-semibold">{t(preview?"Confirmar alterações":"Editar workspace")}</h2><button type="button" className="ui-btn p-2" disabled={busy} onClick={onClose} aria-label={t("Fechar")}><X size={18}/></button></div>
  <form onSubmit={e=>{e.preventDefault();submit();}} className="mt-5 space-y-4">
   {preview?<div className="space-y-4 rounded-xl border bg-subtle p-4"><div><p className="text-xs text-muted">{t("Nome do workspace")}</p><p className="mt-1 break-words">{preview.beforeName} → <strong>{preview.name}</strong></p></div><div><p className="text-xs text-muted">{t("Endereço do workspace")}</p><p className="mt-1 break-all text-sm">/dashboard/{preview.beforeSlug}/sites</p><p className="mt-1 break-all text-sm font-semibold">→ /dashboard/{preview.slug}/sites</p></div></div>:<><label className="block text-sm font-medium">{t("Nome do workspace")}<input autoFocus className="ui-input mt-2 w-full" value={name} onChange={e=>{setName(e.target.value);setError("");}} minLength={2} maxLength={80} required disabled={busy}/></label><label className="block text-sm font-medium">{t("Slug")}<input className="ui-input mt-2 w-full" value={slug} onChange={e=>{setSlug(e.target.value);setError("");}} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" autoCapitalize="none" spellCheck={false} required disabled={busy}/><span className="mt-2 block break-all text-xs font-normal text-muted">/dashboard/{slug}/sites</span></label><p className="text-xs text-muted">{t("Usaremos letras minúsculas, números e hífens. A disponibilidade é verificada ao revisar e confirmar.")}</p></>}
   <p className="text-sm leading-6 text-muted">{t("Os links antigos continuarão funcionando. Seus sites e conteúdos não serão alterados.")}</p>
   {error&&<p role="alert" className="text-sm text-red-700">{t(error)}</p>}
   <div className="flex justify-end gap-2 border-t pt-4"><button type="button" disabled={busy} className="ui-btn" onClick={()=>{setError("");if(preview)setPreview(null);else onClose();}}>{t(preview?"Voltar":"Cancelar")}</button><button type="submit" disabled={busy||(!preview&&name===workspace.name&&slug===workspace.slug)} className="ui-btn ui-btn-primary">{t(busy?"Processando…":preview?"Confirmar alterações":"Revisar alterações")}</button></div>
  </form>
 </dialog>;
}
