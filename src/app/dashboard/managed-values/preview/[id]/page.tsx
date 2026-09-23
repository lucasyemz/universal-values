import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("valuePreview");
}

import { getText } from "@/i18n/server";
import { FreshLink } from "@/components/ui/fresh-link";
import { OccurrenceHeading } from "@/components/scans/occurrence-heading";
import Link from "next/link";
import { getScanSite, loadValuePreview } from "@/modules/scans/service";
import { confirmManagedValue } from "@/modules/scans/actions";
import { valueLabel } from "@/modules/scans/schema";
import { PageHeader } from "@/components/ui";
import { SiteContext } from "@/components/layout/app-shell";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function ValuePreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const t = await getText();

  const { id } = await params;
  const { preview, occurrences, expired } = await loadValuePreview(id);
  const { error } = await searchParams;
  const site = await getScanSite(preview.site_id);
  return <main className="ui-page">
    <SiteContext siteName={site.display_name} title={t("Revisar centralização")} siteId={preview.site_id} workspaceId={site.workspace_id} />
    <FreshLink href={"/dashboard/scans/" + preview.scan_id}>{t("← Sugestões do scan")}</FreshLink>
    <PageHeader title={t("Revisar centralização")} description={t("Confira o valor e as origens que serão vinculadas.")} />
    <section className="mt-8 ui-card p-6">
      <h2 className="text-xl font-semibold">{preview.name}</h2><p className="mt-3 text-sm">{t("Valor encontrado que será mantido:")}</p><p className="mt-2 break-words">{valueLabel(preview.canonical)}</p>
      <p className="mt-4 leading-7 text-muted">{t("Serão criados o valor e seus vínculos com as fontes abaixo, usando o conteúdo observado no scan. Esta etapa organiza as fontes e não altera o Webflow. Após criar, você poderá editar o valor central e revisar uma sincronização das fontes vinculadas.")}</p>
      <Link className="mt-4 inline-block text-accent underline" href={"/dashboard/scans/" + preview.scan_id}>{t("Manter como está e voltar sem criar")}</Link>
      <ul className="mt-5 space-y-3">{occurrences.map((o) => <li className="rounded border p-3" key={o.id}><p className="font-medium">{o.collection_name} → {o.item_name} → {o.field_name}</p><p className="mt-2 break-words"><OccurrenceHeading occurrence={o} /></p></li>)}</ul>
      {error && <p role="alert" className="mt-5 text-amber-800">{t("Não foi possível confirmar. A prévia pode ter expirado ou uma fonte já foi vinculada. Volte ao scan e revise a seleção.")}</p>}
      {preview.managed_value_id ? <Link className="ui-btn ui-btn-primary mt-6" href={"/dashboard/managed-values/" + preview.managed_value_id}>{t("Abrir Managed Value criado")}</Link> : expired ? <p className="mt-6 text-amber-800">{t("Prévia expirada. Prepare uma nova seleção.")}</p> :
        <form action={confirmManagedValue} className="ui-action-bar mt-6 space-y-4"><input type="hidden" name="id" value={id} /><label className="flex gap-3"><input type="checkbox" name="confirmed" value="yes" required />{t("Confirmo que estas fontes representam o mesmo dado de negócio.")}</label><SubmitButton pendingLabel={t("Centralizando…")}>{t("Confirmar centralização")}</SubmitButton></form>}
    </section>
  </main>;
}
