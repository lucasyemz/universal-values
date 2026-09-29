import { enabledSocialProviders } from "@/connectors/supabase/auth-settings";
import { socialLogin } from "@/modules/auth/access-actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { getText } from "@/i18n/server";

export async function SocialLogin() {
  const providers = await enabledSocialProviders();
  const t = await getText();
  if (!providers.length) return null;
  const labels = { google: "Continuar com Google", apple: "Continuar com Apple", azure: "Continuar com Microsoft", "custom:webflow": "Continuar com Webflow" };
  return <div className="mt-6 space-y-3">
    {providers.map(provider => <form action={socialLogin} key={provider}>
      <input name="provider" value={provider} type="hidden" />
      <SubmitButton variant="secondary" className="w-full" pendingLabel={t("Conectando…")}>{t(labels[provider])}</SubmitButton>
    </form>)}
    <p className="pt-2 text-center text-xs text-muted">{t("Ou continue com e-mail")}</p>
  </div>;
}
