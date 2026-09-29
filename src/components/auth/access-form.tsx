"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useText } from "@/i18n/use-text";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestRecovery, resetPassword, signup, type AccessState } from "@/modules/auth/access-actions";

const messages = {
  invalid: "Confira os campos. Use uma senha de 12 a 128 caracteres e repita a mesma senha.",
  sent: "Se o endereço puder receber esta solicitação, enviaremos um e-mail. Confira também o spam. Aguarde um minuto antes de tentar novamente.",
  expired: "O link ou código expirou ou já foi usado. Solicite um novo e-mail de recuperação.",
  retry: "Não foi possível atualizar a senha. Solicite um novo e-mail e tente novamente.",
  unavailable: "O acesso está indisponível. Tente novamente mais tarde.",
};

export function AccessForm({ mode, tokenHash = "" }: { mode: "signup" | "forgot" | "reset"; tokenHash?: string }) {
  const t = useText();
  const action = mode === "signup" ? signup : mode === "forgot" ? requestRecovery : resetPassword;
  const [state, formAction] = useActionState<AccessState, FormData>(action, {});
  const fieldClass = "mt-2 block w-full rounded border border-line p-3";
  return <form action={formAction} className="mt-6 space-y-5">
    {state.message && <p role="status" className="rounded border border-line bg-accent-soft p-3 text-sm">{t(mode === "forgot" && state.message === "invalid" ? "Informe um e-mail válido." : messages[state.message])}</p>}
    {mode === "reset" && tokenHash ? <input type="hidden" name="token_hash" value={tokenHash} /> : <label className="block text-sm font-medium">{t("E-mail")}<input className={fieldClass} type="email" name="email" autoComplete="email" required maxLength={254} /></label>}
    {mode === "reset" && !tokenHash && <label className="block text-sm font-medium">{t("Código de recuperação")}<input className={fieldClass} name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required /></label>}
    {mode !== "forgot" && <>
      <label className="block text-sm font-medium">{t("Nova senha")}<input className={fieldClass} type="password" name="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
      <p className="text-xs text-muted">{t("Use entre 12 e 128 caracteres.")}</p>
      <label className="block text-sm font-medium">{t("Confirmar senha")}<input className={fieldClass} type="password" name="confirmation" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
    </>}
    <SubmitButton className="w-full" pendingLabel={t("Aguarde…")}>{t(mode === "signup" ? "Criar conta" : mode === "forgot" ? "Enviar recuperação" : "Atualizar senha")}</SubmitButton>
    {mode === "forgot" && <Link className="block text-sm text-accent" href="/auth/reset-password">{t("Já tenho um código")}</Link>}
    {mode === "reset" && <Link className="block text-sm text-accent" href="/forgot-password">{t("Solicitar novo e-mail")}</Link>}
    <Link className="block text-sm text-accent" href="/login">{t("Voltar para o login")}</Link>
  </form>;
}
