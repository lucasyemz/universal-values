import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("sitePreview");
}

import { getText } from "@/i18n/server";
import { FreshLink } from "@/components/ui/fresh-link";
import Link from "next/link";
import { loadSitePreview } from "@/modules/sites/service";
import { confirmSiteConnection } from "@/modules/sites/actions";
import { PageHeader, Steps } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function SitePreviewPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const t = await getText();

  const preview = await loadSitePreview((await params).id);
  const { error } = await searchParams;
  return <main className="ui-page !max-w-2xl">
    <FreshLink href={"/dashboard/connections/" + preview.connection_id}>{t("← Escolher site")}</FreshLink>
    <PageHeader title={t("Tudo pronto para conectar?")} description={t("Confira o site antes de confirmar o vínculo.")} />
    <Steps steps={[t("Autorizar"), t("Escolher site"), t("Revisar vínculo")]} current={2} />
    <section className="mt-6 ui-card p-6">
      <h2 className="text-xl font-semibold">{preview.display_name}</h2>
      <p className="mt-3 text-sm text-faint">{t("ID Webflow:")} {preview.webflow_site_id}</p>
      <p className="mt-4 leading-7 text-muted">{t("Este site ficará disponível para consultar o CMS e preparar alterações, sempre com prévia e confirmação.")} {preview.expected_connection_id ? t("A confirmação substituirá a conexão atual deste site.") : t("A confirmação criará um novo vínculo.")}  {t("O site não será publicado. A operação ficará registrada no histórico.")}</p>
      {error && <p role="alert" className="mt-4 text-amber-800">{t("Não foi possível confirmar. O site pode ter mudado, a autorização pode ter expirado ou a prévia ficou desatualizada. Volte e revise o vínculo novamente.")}</p>}
      {preview.site_id ? <Link className="ui-btn ui-btn-primary mt-6" href={"/dashboard/sites/" + preview.site_id + "/scans"}>{t("Vínculo concluído. Abrir scans")}</Link> : preview.expired ? <p role="alert" className="mt-6 text-amber-800">{t("A prévia expirou. Volte e gere uma nova.")}</p> :
        <form action={confirmSiteConnection} className="mt-6 space-y-5">
          <input type="hidden" name="id" value={preview.id} />
          <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" name="confirmed" value="yes" required />{t("Confirmo o vínculo deste site com a autorização escolhida.")}</label>
          <SubmitButton pendingLabel={t("Conectando site…")}>{t("Confirmar vínculo")}</SubmitButton>
        </form>}
    </section>
  </main>;
}
