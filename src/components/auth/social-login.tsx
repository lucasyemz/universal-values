import Image from "next/image";
import { enabledSocialProviders } from "@/connectors/supabase/auth-settings";
import { socialLogin } from "@/modules/auth/access-actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { getText } from "@/i18n/server";

export async function SocialLogin() {
  const providers = await enabledSocialProviders();
  const t = await getText();
  if (!providers.length) return null;
  const labels = { google: "Continuar com Google", apple: "Continuar com Apple", azure: "Continuar com Microsoft", "custom:webflow": "Continuar com Webflow" };
  const names = { google: "Google", apple: "Apple", azure: "Microsoft", "custom:webflow": "Webflow" };
  const logos: Partial<Record<keyof typeof names, string>> = { google: "/brand/providers/google.svg", "custom:webflow": "/brand/providers/webflow.svg" };
  return <div className="mt-6">
    <div className="mb-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" /><span>{t("Ou continue com")}</span><span className="h-px flex-1 bg-line" /></div>
    <div className="grid grid-cols-2 gap-3">
    {providers.map(provider => <form action={socialLogin} key={provider}>
      <input name="provider" value={provider} type="hidden" />
      <SubmitButton variant="secondary" className="auth-provider-card" aria-label={t(labels[provider])} pendingLabel={t("Conectando…")}>
        {logos[provider] && <Image src={logos[provider]} width={26} height={26} alt="" aria-hidden="true" />}
        <span>{names[provider]}</span>
      </SubmitButton>
    </form>)}
    </div>
  </div>;
}
