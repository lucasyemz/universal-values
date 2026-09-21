"use client";
import { useText } from "@/i18n/use-text";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Steps } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { previewScan } from "@/modules/scans/actions";
import { parseScanSetup, scanCollectionsValid } from "@/modules/scans/setup-form";
import { detectionTypes, detectionLabels } from "@/modules/scans/schema";

export function NewScanWizard({ siteId, operationId, collections }: { siteId: string; operationId: string; collections: { id: string; displayName: string }[] }) {
  const t = useText();

  const [step,setStep] = useState(0), [error,setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => { if (previousStep.current !== step) heading.current?.focus(); previousStep.current=step; },[step]);
  function next(form: HTMLFormElement) {
    if (!scanCollectionsValid(new FormData(form))) { setError(t("Selecione de 1 a 20 coleções para continuar.")); return; }
    setError(""); setStep(1);
  }
  return <section className="max-w-3xl rounded-xl border bg-white p-5 md:p-8">
    <Steps steps={[t("Origem e coleções"), t("O que encontrar"), t("Revisar e iniciar")]} current={step} />
    <h2 ref={heading} tabIndex={-1} className="mb-6 text-lg font-semibold">{step === 0 ? t("Onde buscar?") : t("O que você quer encontrar?")}</h2>
        <form action={previewScan} className="space-y-6" onSubmit={event => { if (step === 0) { event.preventDefault(); next(event.currentTarget); } else if (!parseScanSetup(new FormData(event.currentTarget)).success) { event.preventDefault(); setError(t("Selecione pelo menos um tipo ou informe um texto válido para buscar.")); } }}>
          <input type="hidden" name="id" value={operationId} /><input type="hidden" name="siteId" value={siteId} />
          <div>
            <div hidden={step !== 0} className="space-y-6"><fieldset className="space-y-3"><legend className="mb-3 font-semibold">{t("Origem")}</legend>
              <input type="hidden" name="source" value="cms" /><p className="font-medium">{t("CMS Webflow")}</p><p className="text-sm text-muted">{t("Busque nos itens das coleções deste site.")}</p>
              <Link href={"/dashboard/sites/" + siteId + "/static"} className="text-xs text-accent underline">{t("Páginas estáticas — buscar pela extensão do Designer")}</Link>
            </fieldset>
            <fieldset><legend className="mb-2 font-semibold">{t("Coleções")}</legend><p className="mb-3 text-xs text-muted">{t("Selecione de 1 a 20. Menos coleções tornam a leitura mais rápida.")}</p>
              <div className="max-h-72 space-y-2 overflow-y-auto p-1">{collections.length === 0 ? <p className="text-muted">{t("Nenhuma coleção disponível.")}</p> : collections.map((c) => <label key={c.id} className="ui-selection"><input type="checkbox" name="collectionIds" value={c.id} />{c.displayName}</label>)}</div>
            </fieldset></div>
            <div hidden={step !== 1} className="space-y-6"><fieldset><legend className="mb-3 font-semibold">{t("Tipos de conteúdo")}</legend>
              <div className="grid gap-2 sm:grid-cols-2">{detectionTypes.map((type) => <label key={type} className="ui-selection text-sm"><input type="checkbox" name="types" value={type} />{t(detectionLabels[type])}</label>)}</div>
              <p className="mt-3 text-xs text-muted">{t("Selecione pelo menos um tipo ou informe um texto específico.")}</p>
            </fieldset>
            <div className="border-t pt-5"><label className="ui-selection text-sm"><input type="checkbox" name="placeholders" />{t("Lorem Ipsum e textos de exemplo")}</label><p className="mt-2 text-xs text-muted">{t("Encontra textos de exemplo em campos de texto e Rich Text, mesmo sem repetição. Inclui Lorem Ipsum, sample text, placeholder text e texto de exemplo. Revise os resultados antes de substituir.")}</p></div>
            <div className="border-t pt-5"><label htmlFor="search-text" className="block font-semibold">{t("Buscar texto ou número específico")} <span className="font-normal text-muted">{t("(opcional)")}</span></label><input id="search-text" name="searchText" maxLength={200} placeholder={t("Ex.: nome de uma empresa ou 2000")} className="mt-3 w-full" aria-describedby="search-text-help" /><p id="search-text-help" className="mt-2 text-xs leading-6 text-muted">{t("Encontre uma menção dentro de parágrafos ou um valor em campos numéricos do CMS. Em números, a busca considera o valor completo: 2000 não encontra 12000. Use vírgula ou ponto para decimais, sem separador de milhar. A busca exata é o padrão. Ajuste as opções abaixo para incluir variações. Outros tipos selecionados continuam sendo pesquisados.")}</p><fieldset className="mt-4 space-y-2 text-sm"><legend className="mb-2 font-medium">{t("Opções do texto específico")}</legend><label className="flex items-center gap-2"><input type="checkbox" name="ignoreCase" />{t("Ignorar maiúsculas e minúsculas")}</label><label className="flex items-center gap-2"><input type="checkbox" name="ignoreAccents" />{t("Ignorar acentos")}</label><label className="flex items-center gap-2"><input type="checkbox" name="wholeWord" />{t("Palavra ou expressão inteira")}</label><p className="text-xs text-muted">{t("Palavra inteira: “casa” não encontra “casamento”. O texto da substituição será aplicado exatamente como você escrever.")}</p></fieldset></div></div>
          </div>
          <details className="rounded-lg border p-4 text-xs text-muted"><summary className="font-medium">{t("Ver cobertura e limites do scan")}</summary><div className="mt-3 space-y-2 leading-6"><p>{t("Todos os itens das coleções escolhidas precisam ser lidos. Até 100 itens no plano gratuito (500 para administrador) e 1.000 ocorrências; campos acima de 2.000 caracteres ficam fora do scan. O resultado é sinalizado como parcial quando um limite é atingido.")}</p><p>{t("No Rich Text, o texto específico precisa estar contínuo, sem tags ou entidades HTML no meio. Na busca automática, os grupos precisam ter duas ou mais ocorrências. A busca por texto específico também mostra resultados únicos. O texto informado substitui a detecção de textos inteiros pela busca de menções.")}</p><p>{t("O scan lê conteúdo preparado no CMS, incluindo rascunhos. Páginas estáticas não serão lidas.")}</p></div></details>
          {error && <p role="alert" className="text-sm text-red-700">{t(error)}</p>}
          <div className="ui-action-bar flex flex-wrap items-center justify-between gap-4">
            {step === 0 ? <p className="text-xs text-muted">{t("O scan apenas lê conteúdo. Nada será alterado.")}</p> : <button type="button" className="ui-btn" onClick={() => { setStep(0); setError(""); }}>{t("Voltar")}</button>}
            {step === 0 ? <button type="button" disabled={!collections.length} className="ui-btn ui-btn-primary" onClick={event => next(event.currentTarget.form!)}>{t("Continuar")}<ArrowRight size={15} /></button> : <SubmitButton pendingLabel={t("Preparando prévia…")}>{t("Revisar scan")}<ArrowRight size={15} /></SubmitButton>}
          </div>
        </form>
  </section>;
}
