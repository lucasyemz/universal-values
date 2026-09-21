"use client";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { useText } from "@/i18n/use-text";
import { placeholderTargets, type AiBatchTarget } from "@/modules/ai/batch";
import { useAi } from "./provider";
import { AiWorkControls, useAiWork } from "./work";
import { AiConnectionDialog } from "./connection-dialog";
const Context = createContext<{ running: boolean; groupId: string; register: (target: AiBatchTarget) => () => void } | null>(null);
export const useAiBatch = () => useContext(Context);
export function AiBatch({ scanId, groupId, children }: { scanId: string; groupId: string; children: ReactNode }) {
  const t = useText(), ai = useAi();
  const work = useAiWork();
  const targets = useRef(new Map<string, AiBatchTarget>());
  const [connecting, setConnecting] = useState(false);
  const job = work?.job?.scanId === scanId && work.job.groupId === groupId ? work.job : null;
  const running = !!job && job.state !== "done";
  const stopping = job?.state === "stopping";
  const progress = job?.progress;
  const error = job?.error;
  const [count, setCount] = useState(0);
  const [register] = useState(() => (target: AiBatchTarget) => {
    targets.current.set(target.id, target);
    setCount(placeholderTargets([...targets.current.values()]).length);
    return () => { targets.current.delete(target.id); setCount(placeholderTargets([...targets.current.values()]).length); };
  });
  function generate() { return work?.start(scanId, [...targets.current.values()], false, groupId); }
  return <Context.Provider value={{ register, running, groupId }}>
    {(count > 0 || progress) && <section className="ui-card mt-6 p-4" aria-label={t("Preencher este grupo com IA")}>
      <button type="button" className="ui-btn disabled:opacity-40 disabled:cursor-not-allowed" disabled={work?.busy || running || ai.loading || !count} onClick={() => { if (ai.configured) void generate(); else setConnecting(true); }}><Sparkles size={16} aria-hidden="true" />{t("Preencher este grupo com IA")} ({count})</button>
      <p className="mt-2 text-xs text-muted">{t("Preenche até 20 textos de exemplo deste grupo por lote, usando o contexto de cada item. Preserva edições e Managed Values. As demais ações ficam bloqueadas durante a geração.")}</p>
      {running && <button type="button" className="ui-btn mt-3" disabled={stopping} onClick={() => { work?.stop(); }}>{stopping ? t("Parando após a solicitação atual…") : t("Parar geração")}</button>}
      {progress && <p className="mt-3 text-sm" role="status">{t("{0} de {1} processados · {2} preenchidos", progress.completed, progress.total, progress.filled)}{running ? ` · ${t("Gerando…")}` : ""}</p>}
      {!!progress?.issues.length && <ul className="mt-2 text-sm text-amber-800">{progress.issues.map((issue, index) => <li key={index}>{issue.label}: {t(issue.message)}</li>)}</ul>}
      {error && <p role="alert">{error}</p>}
    </section>}
    {connecting && <AiConnectionDialog onClose={() => setConnecting(false)} onConnected={() => { setConnecting(false);void generate(); }} />}
    <AiWorkControls>{children}</AiWorkControls>
  </Context.Provider>;
}
