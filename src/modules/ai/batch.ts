import { directSuggestionInput } from "./direct-suggestion";
import { isPlaceholder, type AiContext, type Suggestion, type SuggestionInput } from "./schema";

export type AiBatchTarget = { source?: string; original?: string; id: string; label: string; read: () => { value: string; eligible: boolean }; apply: (value: string) => void };
export function placeholderTargets(targets: AiBatchTarget[]) {
  return targets.filter(target => { const current = target.read(); return current.eligible && isPlaceholder(current.value); }).slice(0, 20);
}
export type BatchProgress = { completed: number; total: number; filled: number; issues: { label: string; message: string }[] };
type ContextResult = { ok: true; context: AiContext } | { ok: false; message: string };
export async function fillPlaceholderBatch(options: {
  targets: AiBatchTarget[]; signal: AbortSignal;
  prepare: (ids: string[]) => Promise<Record<string, ContextResult>>;
  suggest: (input: SuggestionInput) => Promise<Suggestion>;
  progress: (value: BatchProgress) => void;
  wait: (signal: AbortSignal) => Promise<void>;
}) {
  const targets = placeholderTargets(options.targets);
  const state: BatchProgress = { completed: 0, total: targets.length, filled: 0, issues: [] };
  const publish = () => options.progress({ ...state, issues: [...state.issues] });
  publish();
  if (!targets.length || options.signal.aborted) return;
  const contexts = await options.prepare(targets.map(target => target.id));
  let generated = false;
  for (const target of targets) {
    if (options.signal.aborted) break;
    const source = target.read();
    if (!source.eligible || !isPlaceholder(source.value)) { state.completed++; publish(); continue; }
    const prepared = contexts[target.id];
    if (!prepared?.ok) {
      state.issues.push({ label: target.label, message: prepared && !prepared.ok ? prepared.message : "Não foi possível ler o contexto." });
      state.completed++; publish(); continue;
    }
    let input: SuggestionInput;
    try { input = directSuggestionInput(prepared.context, source.value); }
    catch { state.issues.push({ label: target.label, message: "Não há contexto suficiente para gerar." }); state.completed++; publish(); continue; }
    if (generated) await options.wait(options.signal);
    if (options.signal.aborted) break;
    const before = target.read();
    if (!before.eligible || before.value !== source.value) { state.completed++; publish(); continue; }
    try {
      generated = true;
      const result = await options.suggest(input);
      if (options.signal.aborted) break;
      const current = target.read();
      if (result.needsContext) state.issues.push({ label: target.label, message: "Não há contexto suficiente para gerar." });
      else if (current.eligible && current.value === source.value) { target.apply(result.text); state.filled++; }
      else state.issues.push({ label: target.label, message: "O campo foi editado; o texto foi preservado." });
    } catch (error) {
      if (options.signal.aborted) break;
      state.issues.push({ label: target.label, message: error instanceof Error ? error.message : "Não foi possível gerar o texto. Tente novamente." });
      state.completed++; publish(); break; // Quota/network failure: stop, never retry automatically.
    }
    state.completed++; publish();
  }
}
export function waitForAiInterval(signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); };
    const timer = setTimeout(done, 10_100);
    signal.addEventListener("abort", done, { once: true });
    if (signal.aborted) done();
  });
}
