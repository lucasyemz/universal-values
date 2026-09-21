"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createAiWorkLock } from "@/modules/ai/work-lock";
import { backgroundTarget } from "@/modules/ai/background-target";
import { fillPlaceholderBatch, placeholderTargets, waitForAiInterval, type AiBatchTarget, type BatchProgress } from "@/modules/ai/batch";
import { prepareAiContexts } from "@/modules/ai/actions";
import { directSuggestionInput } from "@/modules/ai/direct-suggestion";
import { useAi } from "./provider";
export type AiJob = { scanId: string; groupId?: string; state: "running" | "stopping" | "done"; progress: BatchProgress; error?: string };
const Context = createContext<{
  busy: boolean; job: AiJob | null; stop: () => void; dismiss: () => void;
  start: (scanId: string, targets: AiBatchTarget[], single?: boolean, groupId?: string) => Promise<void>;
} | null>(null);
export const useAiWork = () => useContext(Context);
export function AiWork({ userId, children }: { userId: string; children: ReactNode }) {
  const ai = useAi();
  const [busy, setBusy] = useState(false), [job, setJob] = useState<AiJob | null>(null);
  const [lock] = useState(() => createAiWorkLock(setBusy));
  const controller = useRef<AbortController | null>(null);
  // Dashboard layout survives route changes. Only leaving it/signing out cancels work.
  useEffect(() => () => controller.current?.abort(), []);
  async function start(scanId: string, candidates: AiBatchTarget[], single = false, groupId?: string) {
    const release = lock.acquire();if (!release) return;
    const abort = new AbortController();controller.current = abort;
    const selected = single ? candidates.slice(0, 1) : placeholderTargets(candidates);
    setJob({ scanId, groupId, state: "running", progress: { total: selected.length, completed: 0, filled: 0, issues: [] } });
    try {
      const targets = selected.map(target => backgroundTarget(target, userId, scanId, window.localStorage, () => window.dispatchEvent(new Event("copyreplace:drafts"))));
      const progress = (value: BatchProgress) => { if (!abort.signal.aborted) setJob({ scanId, groupId, state: "running", progress: value }); };
      if (single) {
        const target = targets[0];if (!target) return;
        const prepared = (await prepareAiContexts({ scanId, occurrenceIds: [target.id] }))[target.id];
        if (abort.signal.aborted) return;
        if (!prepared?.ok) throw new Error(prepared && !prepared.ok ? prepared.message : "Não foi possível ler o contexto.");
        const result = await ai.suggest(directSuggestionInput(prepared.context, target.read().value));
        if (abort.signal.aborted) return;
        if (result.needsContext) throw new Error("Não há contexto suficiente para gerar.");
        if (!target.read().eligible) throw new Error("O campo foi editado; o texto foi preservado.");
        target.apply(result.text);progress({ completed: 1, total: 1, filled: 1, issues: [] });
      } else await fillPlaceholderBatch({ targets, signal: abort.signal,
        prepare: occurrenceIds => prepareAiContexts({ scanId, occurrenceIds }), suggest: ai.suggest, progress, wait: waitForAiInterval });
    } catch (error) {
      if (!abort.signal.aborted) setJob(previous => previous && ({ ...previous, error: error instanceof Error ? error.message : "Não foi possível gerar o texto. Tente novamente." }));
    } finally {
      if (controller.current === abort) { controller.current = null;setJob(previous => previous && ({ ...previous, state: "done" })); }
      release();
    }
  }
  return <Context.Provider value={{ busy, job, start,
    stop: () => { controller.current?.abort();setJob(previous => previous && ({ ...previous, state: "stopping" })); },
    dismiss: () => { if (!controller.current) setJob(null); },
  }}>{children}</Context.Provider>;
}
export function AiWorkControls({ children }: { children: ReactNode }) {
  const work = useAiWork();
  return <fieldset disabled={work?.busy} aria-busy={work?.busy} className="min-w-0 border-0 p-0 [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-40 [&_input:disabled]:opacity-60 [&_textarea:disabled]:opacity-60">{children}</fieldset>;
}
