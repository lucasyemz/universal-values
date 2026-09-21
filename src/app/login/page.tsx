import { getText } from "@/i18n/server";
/* Landing is a standalone HTML document and requires full navigation. */
import { redirect } from "next/navigation";
import { getSupabaseConfig } from "@/connectors/supabase/config";
import { createSupabaseServerClient } from "@/connectors/supabase/server";
import { login } from "@/modules/auth/actions";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Brand } from "@/components/layout/brand";
import { Notice } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { ShieldCheck, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = await getText();

  const configured = getSupabaseConfig();
  if (configured) {
    const client = await createSupabaseServerClient();
    const { data } = await client.auth.getUser();
    if (data.user) redirect("/dashboard");
  }
  const { error } = await searchParams;
  return (
    <main className="grid min-h-screen bg-surface lg:grid-cols-2">
      <section className="hidden flex-col justify-between border-r bg-accent-soft p-12 lg:flex"><a href="/"><Brand /></a><div className="max-w-lg"><ShieldCheck size={40} className="mb-8 text-accent" /><h2 className="text-4xl font-semibold leading-tight tracking-tight">{t("Encontre o que se repete.")}<br />{t("Substitua com segurança.")}</h2><p className="mt-6 text-base leading-8 text-muted">{t("Um espaço para encontrar, organizar e atualizar as informações que se repetem no seu CMS Webflow.")}</p></div><p className="text-xs text-muted">{t("CopyReplace · Seu conteúdo, sob seu controle.")}</p></section>
      <section className="flex items-center justify-center px-6 py-16"><div className="w-full max-w-sm">
      <a href="/" className="mb-10 inline-flex lg:hidden"><Brand /></a><LanguageSwitcher />
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">{t("Seu workspace espera por você")}</p><h1 className="text-[28px] font-semibold tracking-tight">{t("Boas-vindas de volta")}</h1><p className="mt-3 text-sm text-muted">{t("Entre para continuar de onde parou.")}</p>
      {!configured ? <Notice tone="warning" title={t("Configuração de acesso pendente")}>{t("Configure as variáveis do Supabase para habilitar o login.")}</Notice> : (
        <form action={login} className="mt-8 space-y-5">
          {error && <p role="alert" className="text-sm text-red-700">{error === "invalid" ? t("Confira o e-mail e a senha informados.") : t("Não foi possível entrar. Confira suas credenciais e tente novamente.")}</p>}
          <label className="block text-sm font-medium">{t("E-mail")}<input className="mt-2 block w-full rounded border border-line p-3" type="email" name="email" autoComplete="username" required maxLength={254} /></label>
          <label className="block text-sm font-medium">{t("Senha")}<input className="mt-2 block w-full rounded border border-line p-3" type="password" name="password" autoComplete="current-password" required maxLength={1024} /></label>
          <SubmitButton className="w-full" pendingLabel={t("Entrando…")}>{t("Entrar")}<ArrowRight size={16} /></SubmitButton>
          <p className="text-xs leading-5 text-muted">{t("Esta ação inicia uma sessão neste navegador.")}</p>
        </form>
      )}
      </div></section>
    </main>
  );
}
