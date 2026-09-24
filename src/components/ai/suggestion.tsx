"use client";
import { useText } from "@/i18n/use-text";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAi } from "./provider";
import { useAiWork } from "./work";
import { useAiBatch } from "./batch";
import { AiConnectionDialog } from "./connection-dialog";

export function AiSuggestion({scanId,occurrenceId,currentValue,onUse,compact=false,batchEligible=false,itemLabel="",sourceValue,originalValue}:{scanId:string;occurrenceId:string;currentValue:string;onUse:(value:string)=>void;compact?:boolean;batchEligible?:boolean;itemLabel?:string;sourceValue:string;originalValue:string}) {
  const t = useText();

  const ai=useAi();
  const batch=useAiBatch();
  const work=useAiWork();
  const [connecting,setConnecting]=useState(false);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  const busy=useRef(false);
  const active=useRef(true);
  const current=useRef(currentValue);
  useEffect(()=>{current.current=currentValue;},[currentValue]);
  useEffect(()=>{active.current=true;return ()=>{active.current=false;};},[]);

  const latest = useRef({ currentValue, batchEligible, onUse });
  useEffect(() => { latest.current = { currentValue, batchEligible, onUse }; }, [currentValue, batchEligible, onUse]);
  const register = batch?.register;
  useEffect(() => register?.({
    id: occurrenceId, label: itemLabel, source: sourceValue, original: originalValue,
    read: () => ({ value: latest.current.currentValue, eligible: active.current && latest.current.batchEligible && !busy.current }),
    apply: value => { if (active.current) latest.current.onUse(value); },
  }), [register, occurrenceId, itemLabel, currentValue, batchEligible, pending, sourceValue, originalValue]);

  async function generate() {
    if(busy.current)return;
    busy.current=true;setPending(true);setError("");
    try {
      await work?.start(scanId, [{ id: occurrenceId, label: itemLabel, source: sourceValue, original: originalValue,
        read: () => ({ value: current.current, eligible: true }), apply: () => {},
      }], true, batch?.groupId);
    } finally { busy.current=false;if(active.current)setPending(false); }
  }
  return <div className={compact ? "min-w-0" : "mt-3"}>
    <button type="button" className="ui-btn disabled:opacity-40 disabled:cursor-not-allowed" disabled={pending||ai.loading||batch?.running||work?.busy}
      title={t("Usa o texto atual e o contexto deste item no Gemini e preenche o campo.")}
      onClick={()=>{if(ai.configured)void generate();else setConnecting(true);}}>
      <Sparkles size={15} aria-hidden="true"/>{pending?t("Gerando…"):t("Sugerir com IA")}
    </button>
    {connecting&&<AiConnectionDialog onClose={()=>setConnecting(false)} onConnected={()=>{setConnecting(false);void generate();}}/>}
    {error&&<p role="alert" className="mt-2 text-sm text-amber-800">{t(error)}</p>}
  </div>;
}
