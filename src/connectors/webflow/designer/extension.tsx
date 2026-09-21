import { DesignerLanguageProvider } from "@/i18n/designer-provider";
import { useText } from "@/i18n/use-text";
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
  const t = useText();

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
    catch (error) { setMessage(error instanceof Error ? error.message : t("Não foi possível concluir o teste.")); }
    finally { setBusy(false); }
  }
  return <main>
    <header><img className="brand-logo" src="./brand/logo-primary.svg" alt="CopyReplace" width="168" height="35" /><h1>{view === "home" ? t("Seu conteúdo, organizado") : t("Textos da página")}</h1><p>{identity ? identity.siteName : t("Abra esta extensão dentro do Webflow Designer.")}</p>
      {home && <nav className="lab-nav"><button disabled={busy} onClick={() => setView("home")}>{t("Início")}</button><a href={dashboardUrl + "/dashboard/workspaces/" + home.workspaceId + "/settings/webflow#designer"} target="_blank" rel="noreferrer">{t("Abrir dashboard ↗")}</a><button disabled={busy} onClick={() => { invalidate(); setHome(undefined); setView("home"); }}>{t("Reconectar")}</button></nav>}
    </header>
    {!home && <section><h2>{t("Conecte sua conta")}</h2><p>{t("Autorize este site no dashboard e cole o código temporário aqui. Prévia, confirmação e resultado serão registrados no seu workspace.")}</p>
      <a className="lab-link" href={dashboardUrl + "/dashboard/designer" + (identity ? "?site=" + encodeURIComponent(identity.siteId) : "")} target="_blank" rel="noreferrer">{t("1. Abrir dashboard e autorizar ↗")}</a>
      <form onSubmit={event => { event.preventDefault(); void run(async () => { const info = await controller.identify(); setIdentity(info); setHome(await controller.dashboard.connect(code, info.siteId)); setCode(""); setMessage(t("Conta conectada para este site.")); }); }}>
        <label>{t("2. Código de conexão")}<input type="password" autoComplete="off" required value={code} onChange={event => setCode(event.target.value)} placeholder={t("Cole o código gerado no dashboard")} /></label><button className="primary" disabled={busy || !code.trim()}>{t("Conectar este site")}</button>
      </form><p className="muted">{t("A sessão dura até 30 dias e pode ser revogada no dashboard. Nenhuma alteração é aplicada ao conectar.")}</p>
    </section>}
    {home && view === "home" && <>
      <div className="lab-grid"><section><span className="badge">DESIGNER</span><h2>{t("Páginas estáticas")}</h2><p>{t("Busque textos iguais e revise as mudanças na página aberta.")}</p><button className="primary" disabled={busy} onClick={() => void run(async () => { invalidate(); setScan(undefined); setMentions([]); setReplacements({}); const info = await controller.identify(); setIdentity(info); setHome(await controller.dashboard.home(info.siteId)); setView("static"); })}>{t("Buscar nesta página")}</button></section>
      <section><span className="badge">DASHBOARD</span><h2>{t("Conteúdo do CMS")}</h2><p>{t("Gerencie coleções, scans e Managed Values em tela cheia.")}</p><a className="lab-link" href={dashboardUrl + "/dashboard/sites/" + home.siteId + "/scans"} target="_blank" rel="noreferrer">{t("Abrir CMS ↗")}</a></section></div>
      <section><h2>{t("Atividade recente")}</h2><p className="muted">{t("Páginas estáticas · resultados informados pela extensão após leitura de verificação.")}</p>{home.recent.length ? home.recent.map(item => <article key={item.id}><a href={dashboardUrl + "/dashboard/sites/" + home.siteId + "/changes/" + item.id} target="_blank" rel="noreferrer">{item.page_name}</a><p>{item.applied}/{item.total}  {t("alterações verificadas ·")} {new Date(item.created_at).toLocaleString(t.dateLocale)}</p></article>) : <p>{t("Nenhuma prévia registrada neste site.")}</p>}</section>
    </>}
    <details className="legacy"><summary>{t("Histórico do protótipo anterior")}</summary><p>{t("Os registros antigos continuam neste navegador. Eles não foram importados para o dashboard.")}</p><button type="button" disabled={busy} onClick={() => void run(() => audit.export())}>{t("Exportar histórico local antigo")}</button></details>
    {home && view === "static" && <>
    <aside>{t("Teste em um")} <strong>{t("site sem Localization")}</strong>{t(". Componentes, CMS, Rich Text, embeds e trechos divididos entre elementos ainda estão fora da busca. A extensão não publica o site.")}</aside>
    <form onSubmit={event => { event.preventDefault(); void run(async () => {
      invalidate(); setScan(undefined); setMentions([]); setReplacements({});
      const { scan: result, mentions: found, home: activity } = await controller.search(search, searchOptions);
      setHome(activity);
      setScan(result); setScannedTerm(search); setScannedOptions(searchOptions); setMentions(found);
      setMessage(found.length ? t("{0} menções iguais encontradas.", found.length) : t("Nenhuma menção encontrada nos textos compatíveis."));
    }); }}>
      <label>{t("Texto para buscar")}<input required maxLength={200} value={search} disabled={busy} onChange={event => { setSearch(event.target.value); invalidate(); setScan(undefined); setMentions([]); }} placeholder={t("Nome da empresa")} /></label>
      <fieldset><legend>{t("Opções de busca")}</legend>{([{ key: "ignoreCase", label: t("Ignorar maiúsculas e minúsculas") }, { key: "ignoreAccents", label: t("Ignorar acentos") }, { key: "wholeWord", label: t("Palavra ou expressão inteira") }] as const).map(option => <label className="check" key={option.key}><input type="checkbox" disabled={busy} checked={searchOptions[option.key]} onChange={event => { setSearchOptions({ ...searchOptions, [option.key]: event.target.checked }); invalidate(); setScan(undefined); setMentions([]); setReplacements({}); }} />{t(option.label)}</label>)}</fieldset><p className="muted">{t("Palavra inteira: “casa” não encontra “casamento” no mesmo nó de texto. Trechos divididos entre elementos continuam fora da busca. Não procura dentro de URLs ou atributos. A substituição usa exatamente o texto que você escrever.")}</p>
      <button className="primary" disabled={busy || !search.trim()}>{busy ? t("Processando…") : t("Buscar nesta página")}</button>
    </form>
    {scan && <section><h2>{t("Resultado da busca")}</h2><p className="muted">{t(searchOptionsLabel(scannedOptions))}</p><p>{scan.nodes.length}  {t("nós de texto lidos ·")} {scan.skipped}  {t("elementos ou blocos ignorados")}</p></section>}
    {scan && mentions.length > 0 && <section>
      <h2>{t("Menções de “")}{scannedTerm}”</h2>
      <label>{t("Novo valor para o grupo")}<input maxLength={2000} disabled={busy} value={bulk} onChange={event => setBulk(event.target.value)} placeholder={t("Vazio remove o trecho")} /></label>
      <button disabled={busy} onClick={() => { setReplacements(Object.fromEntries(mentions.map(mention => [mention.key, bulk]))); invalidate(); }}>{t("Preencher todas as ocorrências")}</button>
      {mentions.map((mention, index) => <article key={mention.key}>
        <label className="check"><input type="checkbox" disabled={busy} checked={Object.hasOwn(replacements, mention.key)} onChange={event => {
          const next = { ...replacements };
          if (event.target.checked) next[mention.key] = mention.text; else delete next[mention.key];
          setReplacements(next); invalidate();
        }} />  {t("Alterar ocorrência")} {index + 1}</label>
        <p className="context">{mention.before}<mark>{mention.text}</mark>{mention.after}</p>
        {Object.hasOwn(replacements, mention.key) && <label>{t("Novo trecho")}<input maxLength={2000} disabled={busy} value={replacements[mention.key]} onChange={event => { setReplacements({ ...replacements, [mention.key]: event.target.value }); invalidate(); }} /><small>{t("Vazio remove somente o trecho destacado.")}</small></label>}
      </article>)}
      <button disabled={busy || !Object.keys(replacements).length} className="primary" onClick={() => void run(async () => { invalidate(); setPlan(await controller.preview(scan, scannedTerm, replacements, scannedOptions)); })}>{t("Salvar prévia e revisar")}</button>
    </section>}
    {plan && <section><h2>{t("Revisar")} {plan.changes.length}  {t("nós de texto")}</h2><p className="muted">{t(searchOptionsLabel(plan.searchOptions))}</p>
      {plan.changes.map(change => <article key={change.id}><small>{t("Antes")}</small><pre>{change.before}</pre><small>{t("Depois")}</small><pre>{change.after || t("(texto removido)")}</pre></article>)}
      <label className="check"><input type="checkbox" checked={testSite} disabled={busy} onChange={event => setTestSite(event.target.checked)} />  {t("Estou em um site de teste sem Localization.")}</label>
      <label className="check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />  {t("Revisei esta prévia e confirmo as alterações desta prévia.")}</label>
      <button className="primary" disabled={busy || !confirmed || !testSite} onClick={() => void run(async () => {
        await controller.apply(plan, confirmed && testSite);
        invalidate(); setScan(undefined); setMentions([]); setReplacements({});
        setMessage(t("Alterações verificadas e registradas no dashboard. O site não foi publicado pela extensão."));
        setHome(await controller.dashboard.home(plan.context.siteId));
      })}>{busy ? t("Aplicando e verificando…") : t("Confirmar e aplicar no Designer")}</button>
    </section>}
    </>}
    <p role="status" aria-live="polite" className="status">{t(message)}</p>
  </main>;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<DesignerLanguageProvider><Extension /></DesignerLanguageProvider>);
