import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseConfig } from "@/connectors/supabase/config";
import { createSupabaseServerClient } from "@/connectors/supabase/server";
import { login } from "@/modules/auth/actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const configured = getSupabaseConfig();
  if (configured) {
    const client = await createSupabaseServerClient();
    const { data } = await client.auth.getUser();
    if (data.user) redirect("/dashboard");
  }
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <Link href="/" className="text-sm text-teal-700">← Universal Values</Link>
      <h1 className="mt-8 text-3xl font-semibold">Entrar</h1>
      {!configured ? <p role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">O acesso ainda não está configurado. Configure as variáveis do Supabase para habilitar o login.</p> : (
        <form action={login} className="mt-8 space-y-5 rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-600">Acesse seu workspace com sua conta de desenvolvimento.</p>
          {error && <p role="alert" className="text-sm text-red-700">{error === "invalid" ? "Confira o e-mail e a senha informados." : "Não foi possível entrar. Confira suas credenciais e tente novamente."}</p>}
          <label className="block text-sm font-medium">E-mail<input className="mt-2 block w-full rounded border border-slate-300 p-3" type="email" name="email" autoComplete="username" required maxLength={254} /></label>
          <label className="block text-sm font-medium">Senha<input className="mt-2 block w-full rounded border border-slate-300 p-3" type="password" name="password" autoComplete="current-password" required maxLength={1024} /></label>
          <button className="w-full rounded bg-teal-800 px-4 py-3 font-medium text-white">Confirmar entrada</button>
          <p className="text-xs leading-5 text-slate-500">Esta ação inicia uma sessão neste navegador. Os eventos de autenticação são registrados pelo Supabase Auth.</p>
        </form>
      )}
    </main>
  );
}
