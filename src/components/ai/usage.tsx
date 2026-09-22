"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getGeminiUsage } from "@/modules/ai/usage-actions";
import { useAiWork } from "./work";
import { useText } from "@/i18n/use-text";
import { Card, Progress, SectionHeader } from "@/components/ui";
export function GeminiUsage() {
  const t=useText(), work=useAiWork();
  const [result,setResult]=useState<Awaited<ReturnType<typeof getGeminiUsage>> | null>(null);
  const [loading,setLoading]=useState(true);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    const refresh=()=>setRevision(value=>value+1);
    window.addEventListener("focus",refresh);
    return ()=>window.removeEventListener("focus",refresh);
  },[]);
  useEffect(()=>{
    let active=true;
    getGeminiUsage().then(next=>{if(active)setResult(next);})
      .catch(()=>{if(active)setResult({ok:false,message:"Não foi possível carregar o consumo Gemini. Tente atualizar."});})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[revision,work?.busy,work?.job?.progress.completed]);
  const usage=result?.ok?result.usage:null;
  return <section className="mb-8" aria-label="Gemini">
    <SectionHeader title="Gemini" description={t("Cota de geração no ReplaceAll, separada dos limites do plano.")} action={<button className="ui-btn" disabled={loading} onClick={()=>{setLoading(true);setRevision(value=>value+1);}}>{loading?t("Atualizando…"):t("Atualizar consumo")}</button>} />
    {!result && <p role="status">{t("Carregando…")}</p>}
    {result && !result.ok && <p role="alert" className="my-3 text-sm text-amber-800">{t(result.message)}</p>}
    {usage && <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card><h3 className="text-sm font-medium">{t("Gerações utilizadas hoje")}</h3><p className="my-3 text-2xl font-semibold">{usage.used} / {usage.limit}</p><Progress value={usage.used} max={usage.limit} label={t("Gerações utilizadas")} /><p className="mt-2 text-sm text-muted">{t("{0} gerações restantes hoje",usage.remaining)}</p></Card>
        <Card><h3 className="text-sm font-medium">{t("Renovação da cota Gemini")}</h3><p className="my-3 font-semibold">{new Date(usage.resetsAt).toLocaleString(t.dateLocale,{timeZone:"UTC"})} UTC</p><p className="text-sm text-muted">{t("Intervalo mínimo: {0} segundos entre pedidos.",usage.intervalSeconds)}</p><p className="mt-2 text-sm">{usage.connected?t("Gemini conectado"):t("Gemini não conectado")}</p><Link className="mt-3 inline-block text-sm text-accent underline" href="/dashboard/settings/integrations">{t("Gerenciar integração")}</Link></Card>
      </div>
      <p className="mt-3 text-xs text-muted">{t("Este limite do ReplaceAll também vale para administradores. Cada pedido autorizado consome uma geração, mesmo se falhar ou for interrompido. Consultar o consumo não gasta cota.")}</p>
    </>}
    <p className="mt-3 text-sm text-muted">{t("A cota do Google é independente e pode ser atingida antes. O ReplaceAll não consulta o saldo de tokens nem a cota restante do seu projeto Google.")} <a className="text-accent underline" href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer">Google AI Studio ↗</a></p>
  </section>;
}
