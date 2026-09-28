"use client";
import { useState } from "react";
import { Search, FileText, Link2, ImageIcon, SlidersHorizontal, ArrowRight, Database } from "lucide-react";
import { useText } from "@/i18n/use-text";
import { SubmitButton } from "@/components/ui/submit-button";
import { AppLimitations } from "@/components/app-limitations";
import { startScan } from "@/modules/scans/actions";
import { parseScanSetup, scanCollectionsValid } from "@/modules/scans/setup-form";
import { detectionTypes, detectionLabels, type Scan } from "@/modules/scans/schema";

type Mode = "text" | "link" | "image" | "advanced";
export function NewScanWizard({ siteId, operationId, collections, initialQuery, initialPlan }: { siteId:string; operationId:string; collections:{id:string;displayName:string}[]; initialQuery?:string; initialPlan?:Scan["plan"]; staticHref:string }) {
 const t=useText();
 const savedTypes=[...new Set(initialPlan?.flatMap(entry=>entry.types ?? ["money","phone","date","number","text"]) ?? ["text"])];
 const [mode,setMode]=useState<Mode>(savedTypes.length===1 && ["text","link","image"].includes(savedTypes[0]!) ? savedTypes[0] as Mode : "advanced");
 const [selected,setSelected]=useState<string[]>(()=>collections.filter(c=>initialPlan?.some(entry=>entry.id===c.id)).map(c=>c.id));
 const [error,setError]=useState("");

 return <section className="ui-card p-5 sm:p-6">
  <form action={startScan} autoComplete="off" className="space-y-6" onSubmit={event=>{
   const data=new FormData(event.currentTarget);
   if(!scanCollectionsValid(data)){event.preventDefault();setError("Selecione de 1 a 20 coleções para continuar.");}
   else if(!parseScanSetup(data).success){event.preventDefault();setError("Selecione pelo menos um tipo ou informe um texto válido para buscar.");}
  }}>
   <input type="hidden" name="id" value={operationId}/><input type="hidden" name="siteId" value={siteId}/><input type="hidden" name="source" value="cms"/>
   <input type="hidden" name="confirmed" value="yes"/>
   <div className="grid items-start gap-8 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
    <section className="space-y-4" aria-labelledby="cms-find-heading">
     <h2 id="cms-find-heading" className="flex items-center gap-2 font-semibold"><Search size={18}/>{t("Buscar no CMS")}</h2>
     <div className="grid grid-cols-2 gap-1 rounded-xl border bg-subtle p-1" role="group" aria-label={t("Tipo de busca")}>{([{key:"text",label:"Texto",Icon:FileText},{key:"link",label:"Links",Icon:Link2},{key:"image",label:"Imagens",Icon:ImageIcon},{key:"advanced",label:"Avançado",Icon:SlidersHorizontal}] as const).map(({key,label,Icon})=><button key={key} type="button" className="ui-tab flex items-center justify-center gap-2" aria-pressed={mode===key} onClick={()=>{setMode(key);setError("");}}><Icon size={15} aria-hidden="true"/>{t(label)}</button>)}</div>
     {mode!=="advanced" && <input type="hidden" name="types" value={mode}/>}
     <fieldset hidden={mode!=="text" && mode!=="advanced"} disabled={mode!=="text" && mode!=="advanced"} className="space-y-3">
      <label htmlFor="search-text" className="block text-sm font-semibold">{t("Texto para buscar")}</label>
      <input id="search-text" name="searchText" defaultValue={initialQuery ?? initialPlan?.[0]?.searchText} maxLength={200} placeholder={t("Nome da empresa")} className="w-full"/>
      <p className="text-xs text-muted">{t("Deixe vazio para encontrar textos repetidos. Informe um termo para buscar menções no CMS.")}</p>
      <fieldset className="mt-4 space-y-2 text-sm"><legend className="mb-2 font-medium">{t("Opções do texto específico")}</legend><label className="flex items-center gap-2"><input type="checkbox" name="ignoreCase" defaultChecked={initialPlan?.[0]?.searchOptions?.ignoreCase} />{t("Ignorar maiúsculas e minúsculas")}</label><label className="flex items-center gap-2"><input type="checkbox" name="ignoreAccents" defaultChecked={initialPlan?.[0]?.searchOptions?.ignoreAccents} />{t("Ignorar acentos")}</label><label className="flex items-center gap-2"><input type="checkbox" name="wholeWord" defaultChecked={initialPlan?.[0]?.searchOptions?.wholeWord} />{t("Palavra ou expressão inteira")}</label><p className="text-xs text-muted">{t("Palavra inteira: “casa” não encontra “casamento”. O texto da substituição será aplicado exatamente como você escrever.")}</p></fieldset>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="placeholders" defaultChecked={initialPlan?.some(entry=>entry.placeholders)}/>{t("Lorem Ipsum e textos de exemplo")}</label>
     </fieldset>
     {mode==="link" && <div className="space-y-2 text-sm text-muted"><p>{t("Encontre URLs repetidas nos campos de link e no Rich Text das coleções selecionadas.")}</p><p>{t("A busca compara o destino exato. Não verifica se os links estão online.")}</p></div>}
     {mode==="image" && <div className="space-y-2 text-sm text-muted"><p>{t("Encontre imagens repetidas em campos de imagem, galerias e Rich Text das coleções selecionadas.")}</p><p>{t("As imagens são agrupadas pela mesma URL, não por semelhança visual.")}</p></div>}
     <fieldset hidden={mode!=="advanced"} disabled={mode!=="advanced"} className="space-y-2"><legend className="mb-2 text-sm font-semibold">{t("Tipos de conteúdo")}</legend>{detectionTypes.map(type=><label key={type} className="flex items-center gap-2 text-sm"><input type="checkbox" name="types" value={type} defaultChecked={savedTypes.includes(type)}/>{t(detectionLabels[type])}</label>)}</fieldset>
    </section>
    <section className="space-y-4 lg:border-l lg:pl-8"><p className="flex items-center gap-2 text-sm text-muted"><Database size={16} aria-hidden="true"/>{t("CMS Webflow")}</p><fieldset><legend className="mb-2 font-semibold">{t("Coleções")}</legend><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted">{t("Selecione de 1 a 20. Menos coleções tornam a leitura mais rápida.")}</p><div className="flex items-center gap-3 text-xs"><span role="status">{t("{0} de {1} selecionadas", selected.length, collections.length)}</span>{collections.length > 0 && <button type="button" className="border-l pl-3 font-medium text-accent hover:underline" onClick={() => { setSelected(selected.length === Math.min(collections.length, 20) ? [] : collections.slice(0, 20).map(c => c.id)); setError(""); }}>{selected.length === Math.min(collections.length, 20) ? t("Limpar seleção") : collections.length > 20 ? t("Selecionar primeiras 20") : t("Selecionar todas")}</button>}</div></div>
              <div className="grid max-h-80 gap-3 overflow-y-auto p-1 sm:grid-cols-2">{collections.length === 0 ? <p className="text-muted">{t("Nenhuma coleção disponível.")}</p> : collections.map(c => <label key={c.id} className="ui-selection min-h-14 text-sm"><input type="checkbox" name="collectionIds" value={c.id} checked={selected.includes(c.id)} disabled={selected.length >= 20 && !selected.includes(c.id)} onChange={event => { setSelected(previous => event.target.checked ? [...previous, c.id] : previous.filter(id => id !== c.id)); setError(""); }} /><span className="break-words">{c.displayName}</span></label>)}</div>
            </fieldset><p className="text-xs text-muted">{t("O scan lê conteúdo preparado no CMS, incluindo rascunhos. Páginas estáticas não serão lidas.")}</p></section>
   </div>
   <details className="border-t pt-4 text-xs text-muted"><summary className="cursor-pointer font-medium">{t("Ver cobertura e limites do scan")}</summary><div className="mt-3 space-y-2"><p>{t("Todos os itens das coleções escolhidas precisam ser lidos. Até 100 itens no plano gratuito (500 para administrador) e 1.000 ocorrências; campos acima de 2.000 caracteres ficam fora do scan. O resultado é sinalizado como parcial quando um limite é atingido.")}</p><AppLimitations/></div></details>
   {error && <p role="alert" className="text-sm text-red-700">{t(error)}</p>}
   <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-xs text-muted">{t("O scan apenas lê conteúdo. Nada será alterado.")}</p><SubmitButton disabled={!selected.length} pendingLabel={t("Iniciando scan…")}>{t("Pesquisar")}<ArrowRight size={15}/></SubmitButton></div>
  </form>
 </section>;
}
