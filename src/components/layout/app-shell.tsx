"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, ChevronDown, ChevronRight, Globe2, History, LayoutGrid, Layers3, Menu, ScanLine, ShieldCheck, X } from "lucide-react";
import { AccountMenu } from "./account-menu";
import { Brand } from "./brand";

type Context = { title: string; siteName?: string; siteId?: string; workspaceId?: string; pathname: string };
const PageContext = createContext<(value: Context | null) => void>(() => {});
export function SiteContext({ title, siteName, siteId, workspaceId }: Omit<Context, "pathname">) {
  const set = useContext(PageContext);
  const pathname = usePathname();
  useEffect(() => { set({ title, siteName, siteId, workspaceId, pathname }); return () => set(null); }, [set, title, siteName, siteId, workspaceId, pathname]);
  return null;
}
export function AppShell({ children, workspaces, email, workspaceError, plan }: { children: ReactNode; workspaces: { id: string; name: string }[]; email?: string; workspaceError?: boolean; plan: "free" | "admin" }) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => { if (event.persisted) router.refresh(); };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, [router]);
  const [context, setContext] = useState<Context | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const current = context?.pathname === pathname ? context : null;
  const routeWorkspace = pathname.match(/\/workspaces\/([^/]+)\/sites/)?.[1];
  const workspaceId = routeWorkspace ?? current?.workspaceId ?? (workspaces.length === 1 ? workspaces[0]?.id : undefined);
  const siteId = current?.siteId;
  const visibleSiteBase = pathname.match(/^\/dashboard\/[^/]+\/sites\/[^/]+/)?.[0] ?? pathname.match(/^\/dashboard\/sites\/[^/]+/)?.[0];
  const siteBase = siteId ? visibleSiteBase ?? "/dashboard/sites/" + siteId : null;
  const siteName = current?.siteName ?? "Site";
  const siteSections = [
    { path: "scans", label: "Scans", Icon: ScanLine },
    { path: "managed-values", label: "Managed Values", Icon: Layers3 },
    { path: "changes", label: "Alterações", Icon: History },
    { path: "cms", label: "Explorar CMS", Icon: Globe2 },
  ];
  const activeSection = siteBase ? siteSections.find(section => pathname === siteBase + "/" + section.path || pathname.startsWith(siteBase + "/" + section.path + "/") || pathname.startsWith("/dashboard/" + section.path + "/")) : undefined;
  const isOverview = pathname === siteBase + "/overview";
  const pageTitle = current?.title ?? (routeWorkspace ? workspaces.find(w => w.id === routeWorkspace)?.name : pathname === "/dashboard" ? "Visão geral" : pathname === "/dashboard/plan" ? "Plano e consumo" : "Revisão");
  const close = () => dialog.current?.close();
  const sidebar = <>
    <Link href="/dashboard" onClick={close} className="mb-8 inline-flex"><Brand /></Link>
    <label className="mb-6 block text-[11px] font-semibold uppercase tracking-wider text-faint">Workspace
      <select aria-label="Selecionar workspace" value={workspaceId ?? ""} className="mt-2 w-full normal-case tracking-normal" onChange={(event) => { close(); router.push(event.target.value ? "/dashboard/workspaces/" + event.target.value + "/sites" : "/dashboard"); }}>
        <option value="">{workspaceError ? "Workspaces indisponíveis" : "Todos os workspaces"}</option>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
    </label>
    <nav aria-label="Navegação principal" className="space-y-1">
      <Link onClick={close} href="/dashboard" className="ui-nav-link" aria-current={pathname === "/dashboard" ? "page" : undefined}><LayoutGrid size={17} aria-hidden="true" />Visão geral</Link>
      {workspaceId && <Link onClick={close} href={"/dashboard/workspaces/" + workspaceId + "/sites"} className="ui-nav-link" aria-current={!!routeWorkspace || /\/sites$/.test(pathname) && !current?.siteId ? "page" : undefined}><Globe2 size={17} aria-hidden="true" />Sites</Link>}
      {siteBase && <><p title={siteName} className="truncate px-3 pb-2 pt-6 text-[11px] font-semibold uppercase tracking-wider text-faint">{siteName}</p>
        <Link onClick={close} href={siteBase + "/overview"} className="ui-nav-link" aria-current={isOverview ? "page" : undefined}><LayoutGrid size={17} className="shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1">Visão geral do site</span><ChevronDown size={14} className="shrink-0 text-faint" aria-hidden="true" /></Link>
        <ul aria-label={"Páginas de " + siteName} className="ml-5 space-y-1 border-l pl-2">
          {siteSections.map(({path,label,Icon}) => <li key={path}><Link onClick={close} href={siteBase + "/" + path} className="ui-nav-link" aria-current={activeSection?.path === path ? "page" : undefined}><Icon size={16} className="shrink-0" aria-hidden="true" /><span>{label}</span></Link></li>)}
        </ul>
        <details className="pt-2" open={pathname.startsWith(siteBase + "/facts") || pathname === siteBase + "/static" || undefined}><summary className="px-3 py-2 text-xs font-medium text-muted">Avançado</summary>
          <Link onClick={close} href={siteBase + "/facts"} className="ui-nav-link" aria-current={pathname.startsWith(siteBase + "/facts") ? "page" : undefined}><BookOpen size={17} aria-hidden="true" />Global Facts</Link>
        </details>
      </>}
    </nav>
    <div className="mt-auto pt-8">
      <details className="mb-5 rounded-lg bg-subtle p-3 text-xs text-muted"><summary className="font-medium"><BookOpen size={14} className="mr-2 inline" aria-hidden="true" />Como funciona</summary><p className="mt-3 leading-6">Conecte um site, prepare um scan e revise as ocorrências. Toda alteração no CMS exige sua confirmação. O site não é publicado automaticamente.</p></details>
      <AccountMenu email={email} plan={plan} workspaceId={workspaceId} onNavigate={close} />
    </div>
  </>;
  return <PageContext.Provider value={setContext}>
    <a className="skip-link" href="#page-content">Pular para o conteúdo</a>
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col overflow-y-auto border-r bg-surface p-5 lg:flex">{sidebar}</aside>
    <dialog ref={dialog} className="ui-mobile-dialog" aria-label="Menu de navegação"><button type="button" onClick={close} className="ui-btn ui-btn-ghost mb-4" aria-label="Fechar menu"><X size={18} aria-hidden="true" /></button><div className="flex min-h-[80dvh] flex-col">{sidebar}</div></dialog>
    <div className="min-h-screen lg:pl-60">
      <div className="flex min-h-16 items-center justify-between gap-3 border-b bg-surface px-4 md:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3 py-3"><button type="button" className="ui-btn ui-btn-ghost shrink-0 lg:hidden" aria-label="Abrir menu" onClick={() => dialog.current?.showModal()}><Menu size={19} /></button>
          <nav aria-label="Breadcrumb" className="min-w-0"><ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <li><Link href="/dashboard" className="text-muted hover:text-accent">Workspace</Link></li>
            {siteBase ? <>
              <li className="flex min-w-0 max-w-full items-center gap-2"><ChevronRight size={13} className="shrink-0 text-faint" aria-hidden="true" /><span title={siteName} className="max-w-36 truncate text-muted sm:max-w-52">{siteName}</span></li>
              <li className="flex items-center gap-2"><ChevronRight size={13} className="shrink-0 text-faint" aria-hidden="true" />{isOverview ? <span aria-current="page" className="font-medium">Visão geral do site</span> : <Link href={siteBase + "/overview"} className="text-muted hover:text-accent">Visão geral do site</Link>}</li>
              {activeSection && <li className="flex items-center gap-2"><ChevronRight size={13} className="shrink-0 text-faint" aria-hidden="true" />{pathname === siteBase + "/" + activeSection.path ? <span aria-current="page" className="font-medium">{activeSection.label}</span> : <Link href={siteBase + "/" + activeSection.path} className="text-muted hover:text-accent">{activeSection.label}</Link>}</li>}
              {!isOverview && pathname !== siteBase + "/" + activeSection?.path && <li className="flex min-w-0 max-w-full items-center gap-2"><ChevronRight size={13} className="shrink-0 text-faint" aria-hidden="true" /><span aria-current="page" title={pageTitle} className="max-w-52 truncate font-medium">{pageTitle}</span></li>}
            </> : <li className="flex min-w-0 items-center gap-2"><ChevronRight size={13} className="shrink-0 text-faint" aria-hidden="true" /><span aria-current="page" title={pageTitle} className="truncate font-medium">{pageTitle}</span></li>}
          </ol></nav>
        </div>
        <span className="hidden items-center gap-2 text-xs text-muted sm:flex"><ShieldCheck size={15} className="text-accent" aria-hidden="true" />Alterações sob seu controle</span>
      </div>
      <div id="page-content" tabIndex={-1}>{children}</div>
    </div>
  </PageContext.Provider>;
}
