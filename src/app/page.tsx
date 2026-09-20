import Link from "next/link";
import { ArrowRight, ScanLine, Layers3, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/layout/brand";

export default function HomePage() {
  return <div className="min-h-screen bg-surface"><main className="mx-auto max-w-6xl px-6 py-8"><header className="flex items-center justify-between gap-4"><Link href="/"><Brand /></Link><Link href="/login" className="ui-btn">Entrar<ArrowRight size={15} /></Link></header>
    <section className="mx-auto max-w-3xl py-24 text-center sm:py-32"><span className="rounded-full border bg-surface px-4 py-2 text-xs font-medium text-muted">Feito para o seu CMS Webflow</span><h1 className="mt-8 text-4xl font-semibold leading-[1.15] tracking-tight sm:text-6xl">Encontre o que se repete.<br /><span className="text-accent">Substitua com segurança.</span></h1><p className="mx-auto mt-7 max-w-xl text-lg leading-8 text-muted">Encontre informações repetidas no seu site, revise cada ocorrência e atualize seu CMS com confiança.</p><Link className="ui-btn ui-btn-primary mt-8" href="/login">Acessar meu workspace<ArrowRight size={16} /></Link><p className="mt-4 text-xs text-muted">Prévia antes de aplicar. Publicação sob seu controle.</p></section>
    <section aria-label="Como funciona" className="grid gap-5 pb-16 sm:grid-cols-3">{[{ Icon: ScanLine, title: "Encontre o que se repete", body: "Preços, textos, links e imagens nas coleções que você escolher." }, { Icon: Layers3, title: "Organize as ocorrências", body: "Revise os grupos de valores iguais e mantenha o foco no que importa." }, { Icon: ShieldCheck, title: "Mude com segurança", body: "Confira o antes e depois. Só aplique quando estiver pronto." }].map(({ Icon, title, body }) => <article key={title} className="ui-card p-7"><Icon size={22} className="mb-5 text-accent" /><h2 className="text-base font-semibold">{title}</h2><p className="mt-3 text-sm leading-6 text-muted">{body}</p></article>)}</section>
    <footer className="border-t py-6 text-xs text-muted">CopyReplace · Seu conteúdo, sob seu controle.</footer>
  </main></div>;
}
