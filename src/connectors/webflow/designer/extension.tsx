import { LiveTextContext } from "@/components/live-text-context";
import {newScanFromSitePath} from "../../../modules/routes/resources";
import {useSearchTabState,type SearchMode} from "./use-search-tab-state";
import {ImageGroupEditor} from "./image-group-editor";
import {DesignerImagePreview} from "@/components/designer-image-preview";
import {changedImageCount,continueImageScan,reviewedImages,type ImageDraft} from "../../../modules/static-text/image-plan";
import {ImageResults} from "./image-results";
import {editIndividualMention,selectedTextEditor,toggleTextSelection,continueTextScan,continueLinkScan,editSelectedMentions,reviewedOccurrences,mergeReviewed,type ReviewedOccurrence} from "../../../modules/static-text/continue-scan";
import { ValuePreview } from "./value-preview";
import { TriangleAlert, CheckCircle2, Search, ArrowLeft, FileText, Link2, ImageIcon, Database, ArrowUpRight, History, Eye } from "lucide-react";
import { filterLinkGroups, linkGroupCounts, changedLinkDrafts, initialLinkDraft, type LinkDraft, type LinkFilter } from "../../../modules/static-text/repeated-links";
import { LinkGroup } from "./link-group";
import { componentLabel } from "../../../modules/static-text/component-label";
import { DesignerLanguageProvider, DesignerSettings } from "@/i18n/designer-provider";
import { useText } from "@/i18n/use-text";
import { exactSearch, searchOptionsLabel, type SearchOptions } from "../../../modules/text-search/match";
/* eslint-disable @next/next/no-img-element -- Standalone Designer extension bundles its local SVG; no Next.js runtime. */
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { DesignerController } from "./controller";
import { dashboardUrl, DesignerAccessError } from "./dashboard-client";
import type { DesignerHome } from "../../../modules/static-text/protocol";
import { preparePlan, type Mention, type TextPlan } from "../../../modules/static-text/plan";

const controller = new DesignerController();
type Scan = Awaited<ReturnType<DesignerController["port"]["scan"]>>;

function Extension() {
  const t = useText();
  const [localIdentity,setLocalIdentity] = useState(()=>({id:crypto.randomUUID(),now:Date.now()}));
  const [mode,setMode]=useState<SearchMode>("text");
  const [connectionScope,setConnectionScope]=useState(0);
  const tabScope=connectionScope+":"+mode;

  const [reviewFilter,setReviewFilter]=useSearchTabState<"pending"|"reviewed"|"all">(tabScope, "pending");
  const [reviewed,setReviewed]=useSearchTabState<ReviewedOccurrence[]>(tabScope, []);
  const [activeResult,setActiveResult] = useSearchTabState<string|undefined>(tabScope);
  const [restoring,setRestoring] = useState(true);
  const [restoreFailed,setRestoreFailed] = useState(false);
  const [restoreAttempt,setRestoreAttempt] = useState(0);
  const [accessLost,setAccessLost] = useState(false);
  const [identity, setIdentity] = useState<Awaited<ReturnType<DesignerController["identify"]>>>();
  const [home, setHome] = useState<DesignerHome>();
  const [code, setCode] = useState("");
  const [search, setSearch] = useSearchTabState(tabScope, "");
  const [linkDrafts,setLinkDrafts] = useSearchTabState<Record<string,LinkDraft>>(tabScope, {});
  const [imageFilter,setImageFilter]=useSearchTabState<LinkFilter>(tabScope,"repeated");
  const [linkFilter, setLinkFilter] = useSearchTabState<LinkFilter>(tabScope, "all");
  const findLinks=mode==="links",findImages=mode==="images";
  const [imageDrafts,setImageDrafts]=useSearchTabState<Record<string,ImageDraft>>(tabScope, {});
  const [imageScan,setImageScan]=useSearchTabState<Awaited<ReturnType<DesignerController["searchImages"]>>|undefined>(tabScope);
  const [linkScan, setLinkScan] = useSearchTabState<Awaited<ReturnType<DesignerController["searchLinks"]>>["scan"]|undefined>(tabScope);
  const [includeComponents, setIncludeComponents] = useSearchTabState(tabScope, false);
  const [scannedTerm, setScannedTerm] = useSearchTabState(tabScope, "");
  const [searchOptions, setSearchOptions] = useSearchTabState<SearchOptions>(tabScope, exactSearch);
  const [scannedOptions, setScannedOptions] = useSearchTabState<SearchOptions>(tabScope, exactSearch);
  const [scan, setScan] = useSearchTabState<Scan|undefined>(tabScope);
  const [mentions, setMentions] = useSearchTabState<Mention[]>(tabScope, []);
  const [replacements, setReplacements] = useSearchTabState<Record<string, string>>(tabScope, {});
  const [individual, setIndividual] = useSearchTabState(tabScope, false);
  const [plan, setPlan] = useSearchTabState<TextPlan|undefined>(tabScope);
  const [confirmed, setConfirmed] = useSearchTabState(tabScope, false);
  const [testSite, setTestSite] = useState(false);
  const running=useRef(false);
  const [scanning,setScanning]=useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    controller.identify().then(async info => {
      if (!active) return;
      setIdentity(info);
      if (controller.dashboard.hasSession(info.siteId)) { const value = await controller.dashboard.home(info.siteId); if (active) setHome(value); }
    }).catch(error => { if (active) {setAccessLost(error instanceof DesignerAccessError);setRestoreFailed(!(error instanceof DesignerAccessError)); setMessage(error instanceof Error ? error.message : "Abra a extensão no Designer.");} }).finally(()=>{if(active)setRestoring(false);});
    return () => { active = false; };
  }, [restoreAttempt]);
  const cmsScanPath=newScanFromSitePath(home?.dashboardPath);
  const componentWarning=message==="Saia da edição de componentes para testar uma página estática.";
  const pendingCount=findImages?(imageScan?.groups.reduce((sum,g)=>sum+g.occurrences.length,0)??0):findLinks?(linkScan?.groups.reduce((sum,group)=>sum+group.occurrences.length,0)??0):mentions.length;
  const activeImageGroup=imageScan?.groups.find(group=>group.url===activeResult);
  const activeImageDraft=activeImageGroup?(imageDrafts[activeImageGroup.url]??{selected:[]}):undefined;
  const activeGroup=linkScan?.groups.find(group=>group.key===activeResult);
  const textEditor=selectedTextEditor(mentions,replacements,activeResult);
  const activeMention=textEditor.active;
  const localText = useMemo(() => {
    if (mode !== "text" || !scan || !Object.keys(replacements).length) return {plan:undefined, error:""};
    try { return {plan:preparePlan(scan.context,scan.nodes,scannedTerm,replacements,localIdentity.now,scannedOptions,localIdentity.id),error:""}; }
    catch (error) { const message=error instanceof Error ? error.message : "Prévia indisponível."; return {plan:undefined,error:message==="Nenhuma alteração selecionada."?"":message}; }
  },[mode,scan,scannedTerm,replacements,scannedOptions,localIdentity]);
  const reviewPlan = plan ?? localText.plan;

  const activeLinkDraft=activeGroup?(linkDrafts[activeGroup.key]??initialLinkDraft(activeGroup)):undefined;
  const selectedLinks=activeGroup?.occurrences.filter(o=>o.targetId&&activeLinkDraft?.selected.includes(o.targetId))??[];
  const linkCounts = linkGroupCounts(linkScan?.groups ?? []);
  const visibleLinkKeys = new Set(filterLinkGroups(linkScan?.groups ?? [], linkFilter).map(group => group.key));
  const invalidatePreview = () => {setPlan(undefined); setConfirmed(false);setLocalIdentity({id:crypto.randomUUID(),now:Date.now()});};
  const invalidate = () => { setImageScan(undefined);setImageDrafts({}); setLinkScan(undefined); setLinkDrafts({}); invalidatePreview(); };
  function reconnect(){
    controller.dashboard.disconnect();setConnectionScope(current=>current+1);setReviewed([]);setReviewFilter("pending");invalidate();setHome(undefined);setAccessLost(false);setRestoreFailed(false);setMessage("");
    setScan(undefined);setMentions([]);setReplacements({});setActiveResult(undefined);setCode("");
  }
  async function run(action: () => void | Promise<void>, isScan=false) {
    if(running.current)return;
    running.current=true;setScanning(isScan);
    setBusy(true); setMessage("");
    try { await action(); }
    catch (error) { if(error instanceof DesignerAccessError){setAccessLost(true);invalidatePreview();} setMessage(error instanceof Error ? error.message : t("Não foi possível concluir o teste.")); }
    finally { running.current=false;setScanning(false);setBusy(false); }
  }
  return <main className="extension-shell">
    <header className="extension-header"><img className="brand-logo" src="./brand/logo-primary.svg" alt="ReplaceAll" width="168" height="35" /><div className="header-context"><h1>{t("Buscar e substituir")}</h1><p>{identity ? identity.siteName : t("Abra esta extensão dentro do Webflow Designer.")}</p></div>
      {home && !accessLost && <a className="dashboard-button" href={dashboardUrl+(home.dashboardPath??"/dashboard")} target="_blank" rel="noreferrer">{t("Abrir dashboard ↗")}</a>}
      {accessLost && <button disabled={busy} onClick={reconnect}>{t("Reconectar")}</button>}
      <DesignerSettings>{home && <p>{t("Conexão válida até {0}",new Date(home.expiresAt).toLocaleString(t.dateLocale))}</p>}<p className="muted">{t("Problemas de acesso? Conecte novamente este site.")}</p><button type="button" disabled={busy} popoverTarget="designer-settings" popoverTargetAction="hide" onClick={reconnect}>{t("Reconectar")}</button></DesignerSettings>
    </header>
    {!home && restoring && <section role="status">{t("Recuperando conexão salva…")}</section>}
    {!home && !restoring && restoreFailed && <section><p>{t("Não foi possível recuperar a conexão agora. Seu token salvo não foi apagado.")}</p><button disabled={busy} onClick={()=>{setRestoring(true);setRestoreFailed(false);setRestoreAttempt(value=>value+1);}}>{t("Tentar novamente")}</button></section>}
    {!home && !accessLost && !restoring && !restoreFailed && <section><h2>{t("Conecte sua conta")}</h2><p>{t("Autorize este site no dashboard e cole o código temporário aqui. Prévia, confirmação e resultado serão registrados no seu workspace.")}</p>
      <a className="lab-link" href={dashboardUrl + "/dashboard/designer" + (identity ? "?site=" + encodeURIComponent(identity.siteId) : "")} target="_blank" rel="noreferrer">{t("1. Abrir dashboard e autorizar ↗")}</a>
      <form onSubmit={event => { event.preventDefault(); void run(async () => { const info = await controller.identify(); setIdentity(info); setHome(await controller.dashboard.connect(code, info.siteId)); setAccessLost(false); setCode(""); setMessage(t("Conta conectada para este site.")); }); }}>
        <label>{t("2. Código de conexão")}<input type="password" autoComplete="off" required value={code} onChange={event => setCode(event.target.value)} placeholder={t("Cole o código gerado no dashboard")} /></label><button className="primary" disabled={busy || !code.trim()}>{t("Conectar este site")}</button>
      </form><p className="muted">{t("A sessão dura até 30 dias e pode ser revogada no dashboard. Nenhuma alteração é aplicada ao conectar.")}</p>
    </section>}
    {home && !accessLost && <>
    <div className="workflow-grid">
    <div className="search-panel">
    <form id="page-search" className="search-form" onSubmit={event => { event.preventDefault(); void run(async () => {
      invalidate(); setReviewed([]);setReviewFilter("pending");setScan(undefined); setMentions([]); setReplacements({});
      if(findImages){setImageFilter("repeated");setActiveResult(undefined);setImageScan(await controller.searchImages(includeComponents));return;}
      if (findLinks) {
        const result = await controller.searchLinks(includeComponents);
        setLinkScan(result.scan); setActiveResult(result.scan.groups[0]?.key); setLinkFilter("all"); setHome(result.home);
        setMessage(result.scan.groups.length ? t("{0} destinos encontrados.", result.scan.groups.length) : t("Nenhum link encontrado nos elementos compatíveis."));
        return;
      }
      const { scan: result, mentions: found, home: activity } = await controller.search(search, searchOptions, includeComponents);
      setHome(activity);
      setScan(result); setActiveResult(found[0]?.key); setScannedTerm(search); setScannedOptions(searchOptions); setMentions(found);
      setMessage(found.length ? t("{0} menções iguais encontradas.", found.length) : t("Nenhuma menção encontrada nos textos compatíveis."));
    },true); }}>
      <h2><Search size={17} aria-hidden="true" />{t("Buscar nesta página")}</h2>
      {mode==="text" && <label>{t("Texto para buscar")}<input required maxLength={200} value={search} disabled={busy} onChange={event => { setSearch(event.target.value); invalidatePreview(); }} placeholder={t("Nome da empresa")} /></label>}
      <fieldset><legend>{t("Opções de busca")}</legend>
      <div className="mode-tabs" role="group" aria-label={t("Tipo de busca")}>{[{key:"text",label:t("Texto"),icon:FileText},{key:"links",label:t("Links"),icon:Link2},{key:"images",label:t("Imagens"),icon:ImageIcon}].map(option=><button type="button" key={option.key} aria-pressed={mode===option.key} disabled={busy} onClick={()=>{if(mode!==option.key){setConfirmed(false);setMessage("");setMode(option.key as SearchMode);}}}><option.icon size={15} aria-hidden="true" />{option.label}</button>)}{cmsScanPath?<a className="cms-scan-link" href={dashboardUrl+cmsScanPath} target="_blank" rel="noreferrer" title={t("Abrir novo scan do CMS no dashboard")}><Database size={15} aria-hidden="true"/>CMS<ArrowUpRight size={13} aria-hidden="true"/></a>:<button type="button" disabled title={t("Reconecte o site para abrir o scan do CMS.")}><Database size={15} aria-hidden="true"/>CMS</button>}<button type="button" disabled className="seo-coming-soon" title={t("SEO (em breve)")}><Search size={15} aria-hidden="true"/>{t("SEO (em breve)")}</button></div>
      {findLinks && <details className="inline-help"><summary>{t("Sobre a busca de links")}</summary><p className="muted">{t("Agrupa destinos de botões e links nesta página. Não é necessário informar um texto. Revise antes de aplicar alterações. A busca não testa se as URLs estão online.")}</p></details>}<label className="check"><input type="checkbox" disabled={busy} checked={includeComponents} onChange={event => {setIncludeComponents(event.target.checked); invalidatePreview();}} />{t("Incluir componentes (Symbols) desta página")}</label>
      <details className="inline-help"><summary>{t("Sobre componentes")}</summary><p className="muted">{t(findImages ? "Inclui imagens estáticas dos componentes desta página. Vínculos com CMS ficam fora." : findLinks ? "Inclui links do Header, Footer e outros componentes presentes nesta página." : "Inclui textos internos e propriedades dos componentes. Textos compartilhados serão alterados em todas as instâncias do site; propriedades continuam locais. Vínculos com CMS ficam fora.")}</p></details>{mode==="text" && ([{ key: "ignoreCase", label: t("Ignorar maiúsculas e minúsculas") }, { key: "ignoreAccents", label: t("Ignorar acentos") }, { key: "wholeWord", label: t("Palavra ou expressão inteira") }] as const).map(option => <label className="check" key={option.key}><input type="checkbox" disabled={busy} checked={searchOptions[option.key]} onChange={event => { setSearchOptions({ ...searchOptions, [option.key]: event.target.checked }); invalidatePreview(); }} />{t(option.label)}</label>)}</fieldset>{mode==="text" && <details className="inline-help"><summary>{t("Dicas da busca")}</summary><p className="muted">{t("Palavra inteira: “casa” não encontra “casamento” no mesmo nó de texto. Trechos divididos entre elementos continuam fora da busca. Não procura dentro de URLs ou atributos. A substituição usa exatamente o texto que você escrever.")}</p></details>}
      <button className="primary" disabled={busy || (mode==="text" && !search.trim())}>{busy ? t("Processando…") : t("Buscar nesta página")}</button>
    </form>
    <section className="sidebar-activity"><h2><History size={16} aria-hidden="true" />{t("Histórico")}</h2><a className="activity-all" href={dashboardUrl+(home.changesPath??"/dashboard")} target="_blank" rel="noreferrer">{t("Ver todas no dashboard")} ↗</a>{home.recent.slice(0,3).map(item=><article key={item.id}><a href={dashboardUrl+(item.href??home.changesPath??"/dashboard")} target="_blank" rel="noreferrer">{item.page_name}</a><small>{item.applied}/{item.total} {t("alterações verificadas ·")} {new Date(item.created_at).toLocaleDateString(t.dateLocale)}</small></article>)}{!home.recent.length&&<p className="muted">{t("Nenhuma prévia registrada neste site.")}</p>}</section>
    </div><div className="results-panel">
    {(scan||linkScan||imageScan)&&<div className="link-filters" role="group" aria-label={t("Status da revisão")}>{([{key:"pending",label:t("Pendentes"),count:pendingCount},{key:"reviewed",label:t("Revisados"),count:reviewed.length},{key:"all",label:t("Todos"),count:pendingCount+reviewed.length}] as const).map(filter=><button type="button" key={filter.key} disabled={busy} aria-pressed={reviewFilter===filter.key} onClick={()=>{setReviewFilter(filter.key);invalidatePreview();}}>{filter.label} ({filter.count})</button>)}</div>}
    {reviewFilter!=="pending"&&<section><h2>{t("Revisados")}</h2>{reviewed.map(change=><article className="reviewed-occurrence" key={change.reviewKey}>
      <span className="badge"><CheckCircle2 size={12} aria-hidden="true"/> {t("Aplicado")}</span>
      <h3>{change.source?componentLabel(change.source,t):change.location||t("Texto")}</h3>
      <p className="muted">{change.pageName}{change.source&&change.location?` · ${change.location}`:""}</p>
      {change.image?<DesignerImagePreview before={change.image.beforeUrl} after={change.image.asset.url} afterSrc={controller.imagePreviewUrl(change.image.asset)} beforeLabel={t("Antes")} afterLabel={t("Depois")}/>:<ValuePreview title={t("Alteração aplicada")} before={change.link?.beforeLabel??change.before} after={change.link?.afterUrl??change.after}/>}
      {change.contextBefore!==undefined&&<><h3>{t("Contexto original")}</h3><p className="context">{change.contextBefore}<mark>{change.before}</mark>{change.contextAfter}</p></>}
      {change.link?.convertsPage&&<p className="muted">{t("O vínculo com a página foi substituído por uma URL.")}</p>}
      <small>{t("Somente leitura. Esta ocorrência já foi aplicada.")}</small>
    </article>)}{!reviewed.length&&<p className="muted">{t("Nenhuma alteração aplicada neste scan.")}</p>}</section>}
    <div hidden={reviewFilter==="reviewed"} className="pending-results">
    {(scan||linkScan||imageScan)&&pendingCount===0&&<p className="muted">{t("Nenhuma ocorrência pendente neste scan.")}</p>}
    {scanning&&<section className="scan-skeleton" role="status" aria-live="polite" aria-busy="true"><h2>{t("Buscando na página…")}</h2><p className="muted">{t("Lendo os elementos e componentes. Aguarde os resultados.")}</p><div aria-hidden="true">{[0,1,2].map(n=><div className="skeleton-card" key={n}><span/><span/><span/></div>)}</div></section>}
    {!scanning && !scan && !linkScan && !imageScan && <section className="empty-results"><Search size={28} aria-hidden="true" /><h2>{t("Pronto para buscar")}</h2><p>{t("Escolha texto, links ou imagens e busque na página aberta no Designer.")}</p><p className="search-coverage-note">{t("Teste em um")} <strong>{t("site sem Localization")}</strong>{t(". CMS, Rich Text, embeds e trechos divididos entre elementos ficam fora da busca. Componentes exigem a opção abaixo. A extensão não publica o site.")}</p></section>}
    {imageScan&&<><ImageResults scan={imageScan} filter={imageFilter} setFilter={setImageFilter} activeUrl={activeResult} busy={busy} onSelect={url=>{setActiveResult(url);invalidatePreview();}}/></>}
    {linkScan && <section><h2>{t("Links da página")}</h2><p>{t("{0} links lidos · {1} destinos · {2} blocos ou vínculos ignorados", linkScan.total, linkScan.groups.length, linkScan.skipped)}</p>
      <details className="inline-help"><summary>{t("Como os links são contados")}</summary><p className="muted">{t("Repetir um destino pode ser intencional, como no Header e Footer. As quantidades consideram as instâncias na página, incluindo elementos ocultos em outros tamanhos de tela.")}</p></details>
      <div className="link-filters" role="group" aria-label={t("Filtrar destinos")}>
        {([{key:"all",label:t("Todos")},{key:"repeated",label:t("Repetidos")},{key:"unique",label:t("Únicos")}] as const).map(filter => <button type="button" key={filter.key} aria-pressed={linkFilter===filter.key} disabled={busy} onClick={()=>{setLinkFilter(filter.key);invalidatePreview();}}>{filter.label} ({linkCounts[filter.key]})</button>)}
      </div><p className="muted">{t("Contagem por destino. Únicos aparecem em apenas um elemento desta página.")}</p>
      {!visibleLinkKeys.size && <p role="status">{t("Nenhum destino neste filtro.")}</p>}
      {linkScan.groups.filter(group=>visibleLinkKeys.has(group.key)).map(group=><button type="button" className="result-card" key={group.key} aria-pressed={activeResult===group.key} disabled={busy} onClick={()=>{setActiveResult(group.key);invalidatePreview();}}><Link2 size={19} aria-hidden="true"/><span><strong>{group.occurrences[0]?.text||group.occurrences[0]?.label}</strong><span className="result-value">{group.destination}</span><small>{group.occurrences.length} {t("Ocorrências")} · {group.occurrences[0]?.location}</small></span><span className="badge">{t("Links")}</span></button>)}
      <p className="muted">{t("A revisão inclui os destinos alterados em todos os filtros. Destinos sem mudança ficam de fora.")}</p>
    </section>}
    {scan && <section><h2>{t("Resultado da busca")} · {scan.context.pageName}</h2><p className="muted">{t(searchOptionsLabel(scannedOptions))}</p><p>{scan.nodes.length}  {t("nós de texto lidos ·")} {scan.skipped}  {t("elementos ou blocos ignorados")}</p></section>}
    {scan && scan.componentDiagnostics.length > 0 && <details><summary>Component diagnostics</summary><pre>{scan.componentDiagnostics.join("\n")}</pre></details>}
    {scan && mentions.length > 0 && <section>
      <h2>{t("Menções de “")}{scannedTerm}”</h2>
      <label className="check"><input type="checkbox" disabled={busy} checked={mentions.every(mention=>Object.hasOwn(replacements,mention.key))} onChange={event=>{setReplacements(event.target.checked?Object.fromEntries(mentions.map(mention=>[mention.key,replacements[mention.key]??mention.text])):{});invalidatePreview();}}/>{t("Selecionar todos")}</label>
      {mentions.map((mention,index)=><article className="text-result" key={mention.key} data-active={Object.hasOwn(replacements,mention.key)}>
        <input aria-label={`${t("Alterar ocorrência")} ${index+1}`} type="checkbox" disabled={busy} checked={Object.hasOwn(replacements,mention.key)} onChange={event=>{const next={...replacements};if(event.target.checked)next[mention.key]=mention.text;else delete next[mention.key];setReplacements(next);invalidatePreview();}}/>
        <button type="button" className="result-card" aria-pressed={Object.hasOwn(replacements,mention.key)} disabled={busy} onClick={()=>{setReplacements(current=>toggleTextSelection(current,mention));setActiveResult(mention.key);invalidatePreview();}}><FileText size={19} aria-hidden="true"/><span><strong>{mention.location||(mention.source?componentLabel(mention.source,t):t("Texto"))}</strong><span className="result-value context">{mention.before}<mark>{mention.text}</mark>{mention.after}</span></span><span className="badge">{t("Texto")}</span></button>
      </article>)}
    </section>}
    </div></div>
    <div className="editor-stack">
    {!plan && reviewFilter!=="reviewed" && <section className="inspector-panel"><h2><FileText size={20} aria-hidden="true" />{activeImageGroup?(activeImageDraft!.selected.length>1?t("Edição em grupo"):t("Imagens da página")):activeGroup?(selectedLinks.length>1?t("Edição em grupo"):t("Links da página")):textEditor.selected.length>1?t("Edição em grupo"):activeMention?(activeMention.source?componentLabel(activeMention.source,t):activeMention.location||t("Texto")):t("Detalhes")}</h2>
      {activeImageGroup&&activeImageDraft&&<><ImageGroupEditor group={activeImageGroup} draft={activeImageDraft} busy={busy} onEdit={draft=>{setImageDrafts(current=>({...current,[activeImageGroup.url]:draft}));invalidatePreview();}}/><button type="button" className="primary" disabled={busy||!changedImageCount(imageScan!.groups,imageDrafts)} onClick={()=>void run(async()=>{invalidatePreview();setPlan(await controller.previewImages(imageScan!,imageDrafts));})}><Eye size={16} aria-hidden="true"/>{t("Revisar imagens alteradas ({0})",changedImageCount(imageScan!.groups,imageDrafts))}</button></>}
      {activeGroup && <><LinkGroup group={activeGroup} busy={busy} draft={linkDrafts[activeGroup.key]??initialLinkDraft(activeGroup)} onEdit={draft=>{setLinkDrafts(current=>({...current,[activeGroup.key]:draft}));invalidatePreview();}}/>{selectedLinks.length>0&&<ValuePreview title={selectedLinks.length>1?t("Prévia de {0} ocorrências selecionadas",selectedLinks.length):t("Prévia")} before={t(activeGroup.destination)} after={linkDrafts[activeGroup.key]?.url||activeGroup.input||t(activeGroup.destination)}/>}{activeGroup.occurrences.some(o=>o.destination.mode==="pageSection")&&<p className="muted">{t("Ao informar outro destino, o vínculo com a seção será convertido em URL. Use /pagina ou #secao e revise antes de aplicar.")}</p>}<button className="primary" disabled={busy||!changedLinkDrafts(linkScan!.groups,linkDrafts).length} onClick={()=>void run(async()=>{invalidatePreview();setPlan(await controller.previewLinks(linkScan!,linkDrafts));})}><Eye size={16} aria-hidden="true"/>{t("Revisar destinos alterados ({0})",changedLinkDrafts(linkScan!.groups,linkDrafts).length)}</button></>}
      {activeMention && <>
        {textEditor.selected.length>1 && <label className="check"><input type="checkbox" disabled={busy} checked={individual || textEditor.mixed} onChange={event=>{
          setIndividual(event.target.checked);
          if (!event.target.checked) {setReplacements(current=>editSelectedMentions(current,activeMention.key,current[activeMention.key]!));invalidatePreview();}
        }}/>{t("Editar valores individualmente")}</label>}
        {individual || textEditor.mixed ? textEditor.selected.map(mention=>{
          const node=scan?.nodes.find(node=>node.id===mention.nodeId);
          return <article className="individual-text-editor" key={mention.key}>
            <h3>{mention.location || (mention.source?componentLabel(mention.source,t):t("Texto"))}</h3>
            <p className="context">{mention.before}<mark>{mention.text}</mark>{mention.after}</p>
            <label>{t("Substituir por")}<textarea maxLength={2000} disabled={busy} value={replacements[mention.key]!} onChange={event=>{setReplacements(current=>editIndividualMention(current,mention.key,event.target.value));invalidatePreview();}}/></label>
            {!localText.error && node && <><p className="muted">{t("Prévia local no contexto")}</p><LiveTextContext matches={textEditor.selected.filter(mention=>mention.nodeId===node.id)} before={node.text} after={localText.plan?.changes.find(change=>change.id===node.id)?.after ?? node.text} label={t("Depois")} removalLabel={t("O trecho removido não aparece no resultado acima.")}/></>}
          </article>;
        }) : <>
          <label>{textEditor.selected.length>1?t("Novo trecho para {0} ocorrências selecionadas",textEditor.selected.length):t("Substituir por")}<textarea maxLength={2000} disabled={busy} value={textEditor.value} onChange={event=>{setReplacements(current=>editSelectedMentions(current,activeMention.key,event.target.value));invalidatePreview();}}/></label>
          <p className="muted">{t("Prévia local no contexto")}</p>
          {!localText.error && scan?.nodes.filter(node=>textEditor.selected.some(mention=>mention.nodeId===node.id)).map(node=><article key={node.id}>
            <strong>{node.location || (node.source?componentLabel(node.source,t):t("Texto"))}</strong>
            <LiveTextContext matches={textEditor.selected.filter(mention=>mention.nodeId===node.id)} before={node.text} after={localText.plan?.changes.find(change=>change.id===node.id)?.after ?? node.text} label={t("Depois")} removalLabel={t("O trecho removido não aparece no resultado acima.")}/>
            {node.source&&<p className="badge">{componentLabel(node.source,t)}</p>}
          </article>)}
        </>}
        {localText.error&&<p role="alert">{t(localText.error)}</p>}
      </>}
      {(!activeImageGroup&&!activeGroup&&!activeMention)&&<p className="muted">{t(findImages?"Selecione um grupo de imagens para ver as opções.":"Marque uma ocorrência para editar e ver a prévia.")}</p>}
    </section>}
    {reviewPlan && <section className="review-panel">{plan && <button type="button" disabled={busy} onClick={invalidatePreview}><ArrowLeft size={15} aria-hidden="true"/>{t("Voltar à edição")}</button>}<h2><Eye size={17} aria-hidden="true" />{t("Revisar ocorrências")} · {reviewPlan.changes.length}  {t(reviewPlan.changes[0]?.image?"imagens":reviewPlan.changes[0]?.link ? "campos de link" : "nós de texto")}</h2>{!reviewPlan.changes[0]?.link && !reviewPlan.changes[0]?.image && <p className="muted">{t(searchOptionsLabel(reviewPlan.searchOptions))}</p>}
      {reviewPlan.changes.some(change => change.source?.kind === "component-definition") && <aside role="note">{t("Esta prévia inclui componentes compartilhados. A alteração também afeta outras páginas que usam esses componentes. Cada campo compartilhado será alterado uma única vez.")}</aside>}
      {plan && reviewPlan.changes.map(change => <article key={change.id}>{change.source && <p className="badge">{componentLabel(change.source, t)}</p>}{change.link && <><ul>{change.link.buttons.map((button,index)=><li key={index}>{button}</li>)}</ul>{change.link.convertsPage&&<aside>{t("O vínculo com a página ou seção será substituído por uma URL. Futuras mudanças no destino não atualizarão este link automaticamente.")}</aside>}</>}{change.image?<><ul>{change.image.locations.map((location,index)=><li key={index}>{location}</li>)}</ul><DesignerImagePreview before={change.image.beforeUrl} after={change.image.asset.url} afterSrc={controller.imagePreviewUrl(change.image.asset)} beforeLabel={t("Antes")} afterLabel={t("Depois")}/></>:<div className="diff-grid"><div><small>{t("Antes")}</small><pre>{change.link?.beforeLabel??change.before}</pre></div><div className="diff-after"><small>{t("Depois")}</small><pre>{change.link?.afterUrl??(change.after || t("(texto removido)"))}</pre></div></div>}</article>)}
      <label className="check"><input type="checkbox" checked={testSite} disabled={busy} onChange={event => setTestSite(event.target.checked)} />  {t("Estou em um site de teste sem Localization.")}</label>
      <label className="check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />  {t("Revisei esta prévia e confirmo as alterações desta prévia.")}</label>
      <button className="primary" disabled={busy || !confirmed || !testSite} onClick={() => void run(async () => {
        const saved = plan ?? await controller.saveTextPreview(reviewPlan,scannedTerm);
        await controller.apply(saved, confirmed && testSite);
        setReviewed(current=>mergeReviewed(current,reviewPlan.changes[0]?.image?reviewedImages(reviewPlan,imageScan?.groups??[]):reviewedOccurrences(reviewPlan,mentions,replacements,linkScan?.groups??[])));
        if(reviewPlan.changes[0]?.image&&imageScan){
          const next=continueImageScan(imageScan.groups,imageDrafts,reviewPlan);
          setImageScan({...imageScan,groups:next.groups});setImageDrafts(next.drafts);setActiveResult(next.groups[0]?.url);
        }else if(reviewPlan.changes[0]?.link&&linkScan){
          const next=continueLinkScan(linkScan.groups,linkDrafts,reviewPlan);
          setLinkScan({...linkScan,groups:next.groups});setLinkDrafts(next.drafts);setActiveResult(next.groups[0]?.key);
        }else if(scan){
          const next=continueTextScan(scan.nodes,mentions,replacements,reviewPlan,scannedTerm,scannedOptions);
          setScan({...scan,nodes:next.nodes});setMentions(next.mentions);setReplacements(next.replacements);setActiveResult(next.mentions[0]?.key);
        }
        invalidatePreview();
        setMessage(t("Alterações verificadas e registradas no dashboard. O site não foi publicado pela extensão."));
        setHome(await controller.dashboard.home(reviewPlan.context.siteId));
      })}>{busy ? t("Aplicando e verificando…") : reviewPlan.changes[0]?.image?t("Aplicar em {0} campos de imagem",reviewPlan.changes.length):t("Confirmar e aplicar no Designer")}</button>
    </section>}
    </div>
    </div>
    </>}
    <p role={componentWarning?"alert":"status"} aria-live={componentWarning?"assertive":"polite"} className={`status${componentWarning?" status-warning":""}`}>{componentWarning&&<TriangleAlert size={18} aria-hidden="true"/>}{t(message)}</p>
  </main>;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<DesignerLanguageProvider><Extension /></DesignerLanguageProvider>);
