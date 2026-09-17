import { useState } from "react";
import { createRoot } from "react-dom/client";
import { DesignerTextPort } from "./adapter";
import { LocalAuditStore } from "./audit-store";
import { applyPlan } from "../../../modules/static-text/apply";
import { findMentions, preparePlan, type Mention, type TextPlan } from "../../../modules/static-text/plan";

const port = new DesignerTextPort();
const audit = new LocalAuditStore();
type Scan = Awaited<ReturnType<DesignerTextPort["scan"]>>;

function Extension() {
  const [search, setSearch] = useState("");
  const [scannedTerm, setScannedTerm] = useState("");
  const [scan, setScan] = useState<Scan>();
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState("");
  const [plan, setPlan] = useState<TextPlan>();
  const [confirmed, setConfirmed] = useState(false);
  const [testSite, setTestSite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const invalidate = () => { setPlan(undefined); setConfirmed(false); };
  async function run(action: () => void | Promise<void>) {
    setBusy(true); setMessage("");
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível concluir o teste."); }
    finally { setBusy(false); }
  }
  return <main>
    <header><span className="badge">LAB · PÁGINA ESTÁTICA · v0.4</span><h1>Universal Values</h1><p>Buscar e substituir textos na página aberta.</p></header>
    <aside>Prova de conceito para um <strong>site de teste sem Localization</strong>. Componentes, CMS, Rich Text, embeds e trechos divididos entre elementos estão fora deste teste. As alterações ficam no Designer; a extensão não publica o site.</aside>
    <p className="muted">Histórico salvo somente neste navegador. Exporte-o antes de encerrar o teste. Ainda não aparece no dashboard.</p>
    <button type="button" disabled={busy} onClick={() => void run(() => audit.export())}>Exportar histórico local</button>
    <form onSubmit={event => { event.preventDefault(); void run(async () => {
      invalidate(); setScan(undefined); setMentions([]); setReplacements({});
      const result = await port.scan();
      const found = findMentions(result.nodes, search);
      setScan(result); setScannedTerm(search); setMentions(found);
      setMessage(found.length ? `${found.length} menções iguais encontradas.` : "Nenhuma menção encontrada nos textos compatíveis.");
    }); }}>
      <label>Texto exato<input required maxLength={200} value={search} disabled={busy} onChange={event => { setSearch(event.target.value); invalidate(); setScan(undefined); setMentions([]); }} placeholder="Nome da empresa" /></label>
      <p className="muted">Diferencia maiúsculas e minúsculas. Não procura dentro de URLs ou atributos.</p>
      <button className="primary" disabled={busy || !search.trim()}>{busy ? "Processando…" : "Buscar nesta página"}</button>
    </form>
    {scan && <section><h2>{scan.context.pageName}</h2><p>{scan.nodes.length} nós de texto lidos · {scan.skipped} elementos ou blocos ignorados</p></section>}
    {scan && mentions.length > 0 && <section>
      <h2>Menções de “{scannedTerm}”</h2>
      <label>Novo valor para o grupo<input maxLength={2000} disabled={busy} value={bulk} onChange={event => setBulk(event.target.value)} placeholder="Vazio remove o trecho" /></label>
      <button disabled={busy} onClick={() => { setReplacements(Object.fromEntries(mentions.map(mention => [mention.key, bulk]))); invalidate(); }}>Preencher todas as ocorrências</button>
      {mentions.map((mention, index) => <article key={mention.key}>
        <label className="check"><input type="checkbox" disabled={busy} checked={Object.hasOwn(replacements, mention.key)} onChange={event => {
          const next = { ...replacements };
          if (event.target.checked) next[mention.key] = mention.text; else delete next[mention.key];
          setReplacements(next); invalidate();
        }} /> Alterar ocorrência {index + 1}</label>
        <p className="context">{mention.before}<mark>{mention.text}</mark>{mention.after}</p>
        {Object.hasOwn(replacements, mention.key) && <label>Novo trecho<input maxLength={2000} disabled={busy} value={replacements[mention.key]} onChange={event => { setReplacements({ ...replacements, [mention.key]: event.target.value }); invalidate(); }} /><small>Vazio remove somente o trecho destacado.</small></label>}
      </article>)}
      <button disabled={busy || !Object.keys(replacements).length} className="primary" onClick={() => void run(() => { setConfirmed(false); setPlan(preparePlan(scan.context, scan.nodes, scannedTerm, replacements)); })}>Gerar prévia</button>
    </section>}
    {plan && <section><h2>Revisar {plan.changes.length} nós de texto</h2>
      {plan.changes.map(change => <article key={change.id}><small>Antes</small><pre>{change.before}</pre><small>Depois</small><pre>{change.after || "(texto removido)"}</pre></article>)}
      <label className="check"><input type="checkbox" checked={testSite} disabled={busy} onChange={event => setTestSite(event.target.checked)} /> Estou em um site de teste sem Localization.</label>
      <label className="check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /> Revisei esta prévia e confirmo as alterações na página indicada.</label>
      <button className="primary" disabled={busy || !confirmed || !testSite} onClick={() => void run(async () => {
        if (!navigator.locks) throw new Error("Este navegador não oferece o bloqueio necessário para aplicar com segurança.");
        await navigator.locks.request("universal-values-designer-write", { ifAvailable: true }, async lock => {
          if (!lock) throw new Error("Outra janela está aplicando alterações. Aguarde.");
          await applyPlan(plan, confirmed && testSite, port, audit);
        });
        invalidate(); setScan(undefined); setMentions([]); setReplacements({});
        setMessage("Alterações verificadas no Designer. Confira a formatação e exporte o histórico. O site não foi publicado pela extensão.");
      })}>{busy ? "Aplicando e verificando…" : "Confirmar e aplicar no Designer"}</button>
    </section>}
    <p role="status" aria-live="polite" className="status">{message}</p>
  </main>;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Extension />);
