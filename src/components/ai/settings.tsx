"use client";
import { useText } from "@/i18n/use-text";
import { useRef, useState } from "react";
import { useAi } from "./provider";
export function AiSettings({ onConnected }: { onConnected?: () => void } = {}) {
  const t = useText();

  const ai=useAi();
  const [key,setKey]=useState("");const [error,setError]=useState("");
  const [confirmed,setConfirmed]=useState(false);const [revoking,setRevoking]=useState(false);
  const [pending,setPending]=useState(false);const operation=useRef<string | null>(null);
  async function connect(event: React.FormEvent) {
    event.preventDefault();if(pending||!confirmed)return;setPending(true);setError("");
    operation.current ??= crypto.randomUUID();
    try {await ai.connect(key,operation.current);setKey("");operation.current=null;onConnected?.();}
    catch(error){setError(error instanceof Error?error.message:t("Não foi possível conectar o Gemini."));}
    finally {setPending(false);}
  }
  async function revoke(){
    setPending(true);setError("");
    try{await ai.disconnect();setRevoking(false);setConfirmed(false);operation.current=null;}
    catch(error){setError(error instanceof Error?error.message:t("Não foi possível revogar."));}
    finally{setPending(false);}
  }
  return <section className="ui-card max-w-2xl p-6"><h2 className="text-lg font-semibold">{t("Gemini · Sugestões de texto")}</h2>
    <p className="mt-3 text-sm leading-6 text-muted">{t("Conecte sua chave pessoal do Google AI Studio. Ela ficará criptografada na sua conta por 30 dias, inclusive ao sair ou trocar de navegador. Você pode revogar o acesso a qualquer momento.")}</p>
    <p className="mt-3 text-sm leading-6 text-muted">{t("Use um projeto sem faturamento para acessar a faixa gratuita do Google. O ReplaceAll não fornece créditos nem usa uma chave paga quando sua cota termina. Se você ativar faturamento, as cobranças serão da sua conta Google.")}</p>
    {ai.loading?<p className="mt-4" role="status">{t("Carregando conexão…")}</p>:ai.configured?<div className="mt-5 space-y-3">
      <p role="status" className="font-medium">{t("Gemini conectado")}</p><p className="text-sm text-muted">{t("Válido até")} {new Date(ai.connection!.expiresAt).toLocaleDateString(t.dateLocale)}{t(". O Google pode bloquear ou revogar a chave antes desse prazo.")}</p>
      {revoking?<div className="rounded-xl border p-4"><p className="text-sm">{t("Remover a chave salva e impedir novas gerações nesta conta? Textos já gerados serão preservados. Isso não exclui a chave no Google.")}</p><div className="mt-3 flex gap-2"><button type="button" disabled={pending} onClick={()=>void revoke()} className="ui-btn ui-btn-primary">{pending?t("Revogando…"):t("Confirmar revogação")}</button><button type="button" disabled={pending} onClick={()=>setRevoking(false)} className="ui-btn">{t("Cancelar")}</button></div></div>:<button type="button" className="ui-btn" onClick={()=>setRevoking(true)}>{t("Revogar conexão")}</button>}
    </div>:<form className="mt-5 space-y-4" onSubmit={event=>void connect(event)}>
      <a className="ui-btn" href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer">{t("Criar ou administrar chave no Google AI Studio ↗")}</a>
      <label className="block text-sm font-medium">{t("Sua chave Gemini")}<input type="password" autoComplete="off" spellCheck={false} value={key} disabled={pending} onChange={event=>{setKey(event.target.value);operation.current=null;setConfirmed(false);}} required maxLength={8192} className="mt-2 w-full" /></label>
      <p className="text-xs text-muted">{t("Cole a chave completa, incluindo pontos, se houver. A validação consulta o Google sem gerar texto.")}</p>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={pending} onChange={event=>setConfirmed(event.target.checked)} required/>{t("Confirmo que a chave é minha, conferi o faturamento do projeto e autorizo validá-la e armazená-la criptografada por 30 dias.")}</label>
      <button className="ui-btn ui-btn-primary" disabled={pending||!confirmed||!key.trim()}>{pending?t("Validando e conectando…"):t("Conectar Gemini por 30 dias")}</button>
    </form>}
    <p className="mt-4 text-xs leading-6 text-muted">{t("Até 20 gerações por dia e 10 segundos entre pedidos, além das cotas do Google. Ao clicar em Sugerir com IA, o texto atual e o contexto deste item são enviados ao Google e o resultado preenche o campo. Na faixa gratuita, o Google pode usar o conteúdo para melhorar seus produtos.")} <a className="text-accent underline" href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">{t("Termos do Gemini")}</a>.</p>
    {(error||ai.statusError)&&<p role="alert" className="mt-3 text-sm text-red-700">{t(error||ai.statusError)}</p>}
  </section>;
}
