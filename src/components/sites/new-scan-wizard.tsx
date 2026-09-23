"use client";
import { savedTypeHint } from "@/modules/scans/saved-search";
import { AppLimitations } from "@/components/app-limitations";
import { useText } from "@/i18n/use-text";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Info, Search } from "lucide-react";
import { ContextHelp } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { previewScan } from "@/modules/scans/actions";
import { parseScanSetup, scanCollectionsValid } from "@/modules/scans/setup-form";
import { detectionTypes, detectionLabels, type Scan } from "@/modules/scans/schema";

export function NewScanWizard({ siteId, operationId, collections, initialQuery, initialPlan, staticHref }: { siteId: string; operationId: string; collections: { id: string; displayName: string }[]; initialQuery?: string; initialPlan?: Scan["plan"]; staticHref: string }) {
  const t = useText();

  const [step,setStep] = useState(0), [error,setError] = useState("");
  const [selected, setSelected] = useState<string[]>(() => collections.filter(c => initialPlan?.some(entry => entry.id === c.id)).map(c => c.id));
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => { if (previousStep.current !== step) heading.current?.focus(); previousStep.current=step; },[step]);
  function next(form: HTMLFormElement) {
    if (!scanCollectionsValid(new FormData(form))) { setError(t("Selecione de 1 a 20 coleções para continuar.")); return; }
    setError(""); setStep(1);
  }
  return <section className="scan-setup-card">
    <ol className="scan-setup-steps" aria-label={t("Etapas")}>{[t("Origem e coleções"), t("O que encontrar"), t("Revisar e iniciar")].map((label, index) => <li key={label} aria-current={index === step ? "step" : undefined} className={index <= step ? "is-active" : ""}><span>{index < step ? <Check size={17} /> : index + 1}</span><strong>{label}</strong></li>)}</ol>
    <h2 ref={heading} tabIndex={-1} className="mb-6 text-lg font-semibold">{step === 0 ? t("Onde buscar?") : t("O que você quer encontrar?")}</h2>
        <form action={previewScan} className="space-y-6" onSubmit={event => { if (step === 0) { event.preventDefault(); next(event.currentTarget); } else if (!parseScanSetup(new FormData(event.currentTarget)).success) { event.preventDefault(); setError(t("Selecione pelo menos um tipo ou informe um texto válido para buscar.")); } }}>
          <input type="hidden" name="id" value={operationId} /><input type="hidden" name="siteId" value={siteId} />
          <div>
            <div hidden={step !== 0} className="space-y-6"><fieldset className="space-y-3"><legend className="mb-3 font-semibold">{t("Origem")}</legend>
              <input type="hidden" name="source" value="cms" /><div className="scan-source-grid"><div className="scan-source-option is-selected"><span className="scan-source-icon" aria-hidden="true">W</span><div><p className="font-semibold">{t("CMS Webflow")}</p><p className="mt-1 text-sm text-muted">{t("Busque nos itens das coleções deste site.")}</p></div><Check size={21} className="ml-auto shrink-0 rounded-full bg-accent p-1 text-white" aria-hidden="true" /></div><div className="scan-source-option is-disabled" aria-disabled="true"><Search size={25} aria-hidden="true" /><div><p className="font-semibold">{t("SEO (em breve)")}</p><p className="mt-1 text-sm">{t("Busque nas páginas indexadas deste site.")}</p></div></div></div>
              <div className="scan-designer-hint"><Info size={18} className="shrink-0" aria-hidden="true" /><Link href={staticHref} prefetch={false} className="underline underline-offset-2">{t("Páginas estáticas — buscar pela extensão do Designer")}</Link></div>
            </fieldset>
            <fieldset><legend className="mb-2 font-semibold">{t("Coleções")}</legend><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted">{t("Selecione de 1 a 20. Menos coleções tornam a leitura mais rápida.")}</p><div className="flex items-center gap-3 text-xs"><span role="status">{t("{0} de {1} selecionadas", selected.length, collections.length)}</span>{collections.length > 0 && <button type="button" className="border-l pl-3 font-medium text-accent hover:underline" onClick={() => { setSelected(selected.length === Math.min(collections.length, 20) ? [] : collections.slice(0, 20).map(c => c.id)); setError(""); }}>{selected.length === Math.min(collections.length, 20) ? t("Limpar seleção") : collections.length > 20 ? t("Selecionar primeiras 20") : t("Selecionar todas")}</button>}</div></div>
              <div className="grid max-h-80 gap-3 overflow-y-auto p-1 sm:grid-cols-2">{collections.length === 0 ? <p className="text-muted">{t("Nenhuma coleção disponível.")}</p> : collections.map(c => <label key={c.id} className="ui-selection min-h-14 text-sm"><input type="checkbox" name="collectionIds" value={c.id} checked={selected.includes(c.id)} disabled={selected.length >= 20 && !selected.includes(c.id)} onChange={event => { setSelected(previous => event.target.checked ? [...previous, c.id] : previous.filter(id => id !== c.id)); setError(""); }} /><span className="break-words">{c.displayName}</span></label>)}</div>
            </fieldset></div>
            <div hidden={step !== 1} className="space-y-6"><fieldset><legend className="mb-3 font-semibold">{t("Tipos de conteúdo")}</legend>
              <div className="grid gap-2 sm:grid-cols-2">{detectionTypes.map((type) => <label key={type} className="ui-selection text-sm"><input type="checkbox" name="types" value={type} defaultChecked={initialPlan ? initialPlan.some(entry => (entry.types ?? ["money", "phone", "date", "number", "text"]).includes(type)) : !!initialQuery && (type === "text" || type !== "number" && type === savedTypeHint(initialQuery))} />{t(detectionLabels[type])}</label>)}</div>
              <p className="mt-3 text-xs text-muted">{t("Selecione pelo menos um tipo ou informe um texto específico.")}</p>
            </fieldset>
            <div className="border-t pt-5"><label className="ui-selection text-sm"><input type="checkbox" name="placeholders" defaultChecked={initialPlan?.some(entry => entry.placeholders)} />{t("Lorem Ipsum e textos de exemplo")}</label><p className="mt-2 text-xs text-muted">{t("Encontra Lorem Ipsum e outros textos de exemplo, mesmo sem repetição.")}</p></div>
            <div className="border-t pt-5"><label htmlFor="search-text" className="block font-semibold">{t("Buscar texto ou número específico")} <span className="font-normal text-muted">{t("(opcional)")}</span></label><input id="search-text" name="searchText" defaultValue={initialQuery ?? initialPlan?.[0]?.searchText} maxLength={200} placeholder={t("Ex.: nome de uma empresa ou 2000")} className="mt-3 w-full" aria-describedby="search-text-help" /><ContextHelp title={t("Dicas para busca específica")} className="mt-3"><p id="search-text-help" className="mt-2 text-xs leading-6 text-muted">{t("Encontre uma menção dentro de parágrafos ou um valor em campos numéricos do CMS. Em números, a busca considera o valor completo: 2000 não encontra 12000. Use vírgula ou ponto para decimais, sem separador de milhar. A busca exata é o padrão. Ajuste as opções abaixo para incluir variações. Outros tipos selecionados continuam sendo pesquisados.")}</p></ContextHelp><fieldset className="mt-4 space-y-2 text-sm"><legend className="mb-2 font-medium">{t("Opções do texto específico")}</legend><label className="flex items-center gap-2"><input type="checkbox" name="ignoreCase" defaultChecked={initialPlan?.[0]?.searchOptions?.ignoreCase} />{t("Ignorar maiúsculas e minúsculas")}</label><label className="flex items-center gap-2"><input type="checkbox" name="ignoreAccents" defaultChecked={initialPlan?.[0]?.searchOptions?.ignoreAccents} />{t("Ignorar acentos")}</label><label className="flex items-center gap-2"><input type="checkbox" name="wholeWord" defaultChecked={initialPlan?.[0]?.searchOptions?.wholeWord} />{t("Palavra ou expressão inteira")}</label><p className="text-xs text-muted">{t("Palavra inteira: “casa” não encontra “casamento”. O texto da substituição será aplicado exatamente como você escrever.")}</p></fieldset></div></div>
          </div>
          <details className="rounded-lg border p-4 text-xs text-muted"><summary className="font-medium">{t("Ver cobertura e limites do scan")}</summary><div className="mt-3 space-y-2 leading-6"><p>{t("Todos os itens das coleções escolhidas precisam ser lidos. Até 100 itens no plano gratuito (500 para administrador) e 1.000 ocorrências; campos acima de 2.000 caracteres ficam fora do scan. O resultado é sinalizado como parcial quando um limite é atingido.")}</p><p>{t("No Rich Text, o texto específico precisa estar contínuo, sem tags ou entidades HTML no meio. Na busca automática, os grupos precisam ter duas ou mais ocorrências. A busca por texto específico também mostra resultados únicos. O texto informado substitui a detecção de textos inteiros pela busca de menções.")}</p><p>{t("O scan lê conteúdo preparado no CMS, incluindo rascunhos. Páginas estáticas não serão lidas.")}</p><AppLimitations /></div></details>
          {error && <p role="alert" className="text-sm text-red-700">{t(error)}</p>}
          <div className="ui-action-bar flex flex-wrap items-center justify-between gap-4">
            {step === 0 ? <p className="flex items-center gap-2 text-xs text-muted"><Info size={18} aria-hidden="true" />{t("O scan apenas lê conteúdo. Nada será alterado.")}</p> : <button type="button" className="ui-btn" onClick={() => { setStep(0); setError(""); }}>{t("Voltar")}</button>}
            {step === 0 ? <button type="button" disabled={!collections.length} className="ui-btn ui-btn-primary" onClick={event => next(event.currentTarget.form!)}>{t("Continuar")}<ArrowRight size={15} /></button> : <SubmitButton pendingLabel={t("Preparando prévia…")}>{t("Revisar scan")}<ArrowRight size={15} /></SubmitButton>}
          </div>
        </form>
  </section>;
}
