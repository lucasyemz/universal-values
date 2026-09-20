import { exactSearch, searchOptionsLabel, type SearchOptions } from "../../../modules/text-search/match";
/* eslint-disable @next/next/no-img-element -- Standalone Designer extension bundles its local SVG; no Next.js runtime. */
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { LocalAuditStore } from "./audit-store";
import { DesignerController } from "./controller";
import { dashboardUrl } from "./dashboard-client";
import type { DesignerHome } from "../../../modules/static-text/protocol";
import { type Mention, type TextPlan } from "../../../modules/static-text/plan";

const controller = new DesignerController();
const audit = new LocalAuditStore();
type Scan = Awaited<ReturnType<DesignerController["port"]["scan"]>>;

function Extension() {
  const [view, setView] = useState<"home" | "static">("home");
  const [identity, setIdentity] = useState<Awaited<ReturnType<DesignerController["identify"]>>>();
  const [home, setHome] = useState<DesignerHome>();
  const [code, setCode] = useState("");
  const [search, setSearch] = useState("");
  const [scannedTerm, setScannedTerm] = useState("");
  const [searchOptions, setSearchOptions] = useState<SearchOptions>(exactSearch);
  const [scannedOptions, setScannedOptions] = useState<SearchOptions>(exactSearch);
  const [scan, setScan] = useState<Scan>();
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState("");
  const [plan, setPlan] = useState<TextPlan>();
  const [confirmed, setConfirmed] = useState(false);
  const [testSite, setTestSite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    controller.identify().then(async info => {
      if (!active) return;
      setIdentity(info);
      if (controller.dashboard.hasSession()) { const value = await controller.dashboard.home(info.siteId); if (active) setHome(value); }
    }).catch(error => { if (active) setMessage(error instanceof Error ? error.message : "Abra a extensão no Designer."); });
    return () => { active = false; };
  }, []);
  const invalidate = () => { setPlan(undefined); setConfirmed(false); };
  async function run(action: () => void | Promise<void>) {
    setBusy(true); setMessage("");
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível concluir o teste."); }
    finally { setBusy(false); }
  }
  return <main>
    <header><img className="brand-logo" src="./brand/logo-primary.svg" alt="CopyReplace" width="168" height="35" /><h1>{view === "home" ? "Seu conteúdo, organizado" : "Textos da página"}</h1><p>{identity ? identity.siteName : "Abra esta extensão dentro do Webflow Designer."}</p>
      {home && <nav className="lab-nav"><button disabled={busy} onClick={() => setView("home")}>Início</button><a href={dashboardUrl + "/dashboard/sites/" + home.siteId + "/static"} target="_blank" rel="noreferrer">Abrir dashboard ↗</a><button disabled={busy} onClick={() => { invalidate(); setHome(undefined); setView("home"); }}>Reconectar</button></nav>}
    </header>
    {!home && <section><h2>Conecte sua conta</h2><p>Autorize este site no dashboard e cole o código temporário aqui. Prévia, confirmação e resultado serão registrados no seu workspace.</p>
      <a className="lab-link" href={dashboardUrl + "/dashboard/designer" + (identity ? "?site=" + encodeURIComponent(identity.siteId) : "")} target="_blank" rel="noreferrer">1. Abrir dashboard e autorizar ↗</a>
      <form onSubmit={event => { event.preventDefault(); void run(async () => { const info = await controller.identify(); setIdentity(info); setHome(await controller.dashboard.connect(code, info.siteId)); setCode(""); setMessage("Conta conectada para este site."); }); }}>
        <label>2. Código de conexão<input type="password" autoComplete="off" required value={code} onChange={event => setCode(event.target.value)} placeholder="Cole o código gerado no dashboard" /></label><button className="primary" disabled={busy || !code.trim()}>Conectar este site</button>
      </form><p className="muted">A sessão dura até 8 horas e pode ser revogada no dashboard. Nenhuma alteração é aplicada ao conectar.</p>
    </section>}
    {home && view === "home" && <>
      <div className="lab-grid"><section><span className="badge">DESIGNER</span><h2>Páginas estáticas</h2><p>Busque textos iguais e revise as mudanças na página aberta.</p><button className="primary" disabled={busy} onClick={() => void run(async () => { invalidate(); setScan(undefined); setMentions([]); setReplacements({}); const info = await controller.identify(); setIdentity(info); setHome(await controller.dashboard.home(info.siteId)); setView("static"); })}>Buscar nesta página</button></section>
      <section><span className="badge">DASHBOARD</span><h2>Conteúdo do CMS</h2><p>Gerencie coleções, scans e Managed Values em tela cheia.</p><a className="lab-link" href={dashboardUrl + "/dashboard/sites/" + home.siteId + "/scans"} target="_blank" rel="noreferrer">Abrir CMS ↗</a></section></div>
      <section><h2>Atividade recente</h2><p className="muted">Páginas estáticas · resultados informados pela extensão após leitura de verificação.</p>{home.recent.length ? home.recent.map(item => <article key={item.id}><a href={dashboardUrl + "/dashboard/sites/" + home.siteId + "/static#" + item.id} target="_blank" rel="noreferrer">{item.page_name}</a><p>{item.applied}/{item.total} alterações verificadas · {new Date(item.created_at).toLocaleString("pt-BR")}</p></article>) : <p>Nenhuma prévia registrada neste site.</p>}</section>
    </>}
    <details className="legacy"><summary>Histórico do protótipo anterior</summary><p>Os registros antigos continuam neste navegador. Eles não foram importados para o dashboard.</p><button type="button" disabled={busy} onClick={() => void run(() => audit.export())}>Exportar histórico local antigo</button></details>
    {home && view === "static" && <>
    <aside>Teste em um <strong>site sem Localization</strong>. Componentes, CMS, Rich Text, embeds e trechos divididos entre elementos ainda estão fora da busca. A extensão não publica o site.</aside>
    <form onSubmit={event => { event.preventDefault(); void run(async () => {
      invalidate(); setScan(undefined); setMentions([]); setReplacements({});
      const { scan: result, mentions: found, home: activity } = await controller.search(search, searchOptions);
      setHome(activity);
      setScan(result); setScannedTerm(search); setScannedOptions(searchOptions); setMentions(found);
      setMessage(found.length ? `${found.length} menções iguais encontradas.` : "Nenhuma menção encontrada nos textos compatíveis.");
    }); }}>
      <label>Texto para buscar<input required maxLength={200} value={search} disabled={busy} onChange={event => { setSearch(event.target.value); invalidate(); setScan(undefined); setMentions([]); }} placeholder="Nome da empresa" /></label>
      <fieldset><legend>Opções de busca</legend>{([{ key: "ignoreCase", label: "Ignorar maiúsculas e minúsculas" }, { key: "ignoreAccents", label: "Ignorar acentos" }, { key: "wholeWord", label: "Palavra ou expressão inteira" }] as const).map(option => <label className="check" key={option.key}><input type="checkbox" disabled={busy} checked={searchOptions[option.key]} onChange={event => { setSearchOptions({ ...searchOptions, [option.key]: event.target.checked }); invalidate(); setScan(undefined); setMentions([]); setReplacements({}); }} />{option.label}</label>)}</fieldset><p className="muted">Palavra inteira: “casa” não encontra “casamento” no mesmo nó de texto. Trechos divididos entre elementos continuam fora da busca. Não procura dentro de URLs ou atributos. A substituição usa exatamente o texto que você escrever.</p>
      <button className="primary" disabled={busy || !search.trim()}>{busy ? "Processando…" : "Buscar nesta página"}</button>
    </form>
    {scan && <section><h2>Resultado da busca</h2><p className="muted">{searchOptionsLabel(scannedOptions)}</p><p>{scan.nodes.length} nós de texto lidos · {scan.skipped} elementos ou blocos ignorados</p></section>}
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
      <button disabled={busy || !Object.keys(replacements).length} className="primary" onClick={() => void run(async () => { invalidate(); setPlan(await controller.preview(scan, scannedTerm, replacements, scannedOptions)); })}>Salvar prévia e revisar</button>
    </section>}
    {plan && <section><h2>Revisar {plan.changes.length} nós de texto</h2><p className="muted">{searchOptionsLabel(plan.searchOptions)}</p>
      {plan.changes.map(change => <article key={change.id}><small>Antes</small><pre>{change.before}</pre><small>Depois</small><pre>{change.after || "(texto removido)"}</pre></article>)}
      <label className="check"><input type="checkbox" checked={testSite} disabled={busy} onChange={event => setTestSite(event.target.checked)} /> Estou em um site de teste sem Localization.</label>
      <label className="check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /> Revisei esta prévia e confirmo as alterações desta prévia.</label>
      <button className="primary" disabled={busy || !confirmed || !testSite} onClick={() => void run(async () => {
        await controller.apply(plan, confirmed && testSite);
        invalidate(); setScan(undefined); setMentions([]); setReplacements({});
        setMessage("Alterações verificadas e registradas no dashboard. O site não foi publicado pela extensão.");
        setHome(await controller.dashboard.home(plan.context.siteId));
      })}>{busy ? "Aplicando e verificando…" : "Confirmar e aplicar no Designer"}</button>
    </section>}
    </>}
    <p role="status" aria-live="polite" className="status">{message}</p>
  </main>;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Extension />);
