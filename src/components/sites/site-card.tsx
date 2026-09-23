"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Globe2, History, Layers3, Link2, ScanLine } from "lucide-react";
import { useText } from "@/i18n/use-text";
import { StatusBadge } from "@/components/ui";

export function SiteCard({ name, href, url, image, connected }: { name: string; href: string; url: string | null; image: string | null; connected: boolean }) {
  const t = useText();
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const siteBase = href.replace(/\/overview$/, "");
  const shortcuts = [
    { path: "scans", label: t("Scans"), Icon: ScanLine },
    { path: "managed-values", label: "Managed Values", Icon: Layers3 },
    { path: "changes", label: t("Alterações"), Icon: History },
    { path: "cms", label: t("Explorar CMS"), Icon: Globe2 },
  ];
  return <article className="site-project-card">
    <div className="site-project-preview">
      <div className="site-browser-bar"><span className="site-browser-dots" aria-hidden="true"><i /><i /><i /></span><span className="truncate">{url ? new URL(url).hostname : t("URL indisponível")}</span></div>
      {image && failedImage !== image ?
        // Provider thumbnail only; never embed or execute the customer's page.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={t("Prévia de {0}", name)} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedImage(image)} className="site-project-image" /> :
        <div className="site-project-placeholder"><div className="site-placeholder-window" aria-hidden="true"><Globe2 size={36} /><span /><span /><span /></div><h3>{t("Prévia do site indisponível")}</h3><p>{t("Não foi possível carregar uma imagem deste site. Você pode continuar acessando o projeto.")}</p></div>}
    </div>
    <div className="flex flex-wrap items-center gap-3"><Globe2 className="shrink-0 text-accent" size={23} aria-hidden="true" /><h2 className="min-w-0 flex-1 break-words text-lg font-semibold">{name}</h2><span className="rounded-full bg-subtle px-3 py-1 text-xs font-medium text-muted">Webflow</span><StatusBadge status={connected ? "connected" : "disconnected"} /></div>
    <div className="flex min-w-0 items-center gap-3 text-sm"><Link2 size={17} className="shrink-0 text-muted" aria-hidden="true" />{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-2 text-accent hover:underline"><span className="truncate">{url.replace(/^https:\/\//, "")}</span><ExternalLink size={14} className="shrink-0" /><span className="sr-only">{t("(abre em nova aba)")}</span></a> : <span className="text-muted">{t("URL indisponível")}</span>}</div>
    <div className="mt-auto space-y-3 border-t pt-4">
      <Link href={href} prefetch={false} className="ui-btn ui-btn-primary min-h-12 w-full text-base" aria-label={t("Entrar no site {0}", name)}>{t("Entrar no site")}<ArrowRight size={18} aria-hidden="true" /></Link>
      <nav aria-label={name} className="grid grid-cols-2 gap-2">
        {shortcuts.map(({ path, label, Icon }) => <Link key={path} href={`${siteBase}/${path}`} prefetch={false} className="flex min-h-11 items-center gap-2 rounded-lg border border-transparent bg-subtle px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><Icon size={16} className="shrink-0" aria-hidden="true" /><span>{label}</span></Link>)}
      </nav>
    </div>
  </article>;
}
