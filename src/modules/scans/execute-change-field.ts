import type { z } from "zod";
import { WebflowError, type WebflowReader } from "@/connectors/webflow/client";
import type { WebflowWriter } from "@/connectors/webflow/writer";
import type { ManagedField } from "@/modules/managed-values/sync-plan";
import type { changeRequestSchema } from "./change-request-plan";
import { sameField, type FieldChange } from "./change-plan";

type Request = z.infer<typeof changeRequestSchema>;
export type FieldDependencies = {
  getSite(): Promise<{ connection_id: string; webflow_site_id: string }>;
  getConnection(): Promise<{ connection: { workspace_id: string }; reader: Pick<WebflowReader, "sites" | "collections" | "collection" | "item">; writer: Pick<WebflowWriter, "updateField"> }>;
  dispatch(): Promise<boolean>;
};
export async function executeChangeField(input: { request: Request; field: FieldChange; managedField?: ManagedField; dispatched: boolean }, dependencies: FieldDependencies) {
  const { request, field, managedField } = input;
  let dispatched = input.dispatched;
  let sentThisAttempt = false;
  let writeCompleted = false;
  let wait = 0;
  let result: z.infer<typeof changeRequestSchema>["results"][number];
  try {
    const site = await dependencies.getSite();
    if (site.connection_id !== request.connection_id) throw new Error("connection_changed");
    const { reader, writer, connection } = await dependencies.getConnection();
    if (connection.workspace_id !== request.workspace_id) throw new Error("connection_changed");
    const [sites, collections] = await Promise.all([reader.sites(), reader.collections(site.webflow_site_id)]);
    const o = field.occurrence;
    if (!sites.some((s) => s.id === site.webflow_site_id) || !collections.some((c) => c.id === o.collection_id)) throw new Error("source_changed");
    const [details, current] = await Promise.all([reader.collection(o.collection_id), reader.item(o.collection_id, o.item_id, o.locale)]);
    if (details.id !== o.collection_id || !details.fields.some((f) => f.slug === o.field_slug && f.type === o.field_type) || current.id !== o.item_id || (o.locale && current.cmsLocaleId !== o.locale) || current.isArchived) throw new Error("source_changed");
    const actual = current.fieldData[o.field_slug];
    if (sameField(actual, field.after) && (!field.slug || current.fieldData.slug === field.slug.after)) {
      result = { sourceKey: field.sourceKey, status: "already_applied", message: "O campo já contém o valor desejado; nenhuma escrita foi repetida.", actual, ...(field.slug ? { slugActual: field.slug.after } : {}) };
    } else if (dispatched || managedField?.binding.uncertain) {
      result = { sourceKey: field.sourceKey, status: "uncertain", message: managedField ? "Uma tentativa anterior perdeu a confirmação. Confira o campo no Webflow. Uma nova prévia só reconciliará esta fonte se a leitura corresponder exatamente ao valor esperado; não haverá reenvio automático." : "Uma tentativa anterior perdeu a confirmação. Confira o campo no Webflow e faça outro scan; esta operação não será reenviada.", ...(actual !== undefined ? { actual } : {}) };
    } else if (!sameField(actual, field.before) || (field.slug && current.fieldData.slug !== field.slug.before)) {
      result = { sourceKey: field.sourceKey, status: "conflict", message: request.reverts_request_id ? "O campo foi editado após a alteração original. A reversão foi bloqueada para preservar essa edição." : managedField ? "O campo mudou desde o registro do vínculo. Nenhuma alteração aplicada. Confira a edição no Webflow; uma nova prévia não substitui automaticamente o registro em conflito." : "O campo mudou desde o scan. Nenhuma alteração aplicada; execute outro scan.", ...(actual !== undefined ? { actual } : {}) };
    } else {
      const send = await dependencies.dispatch();
      if (!send) throw new Error("dispatch_unavailable");
      dispatched = true;
      sentThisAttempt = true;
      const response = await writer.updateField({ collectionId: o.collection_id, itemId: o.item_id, locale: o.locale, field: o.field_slug, value: field.after, ...(field.slug ? { slug: field.slug.after } : {}) });
      writeCompleted = true;
      const applied = response.fieldData[o.field_slug];
      if (applied === undefined) throw new Error("missing_response_field");
      const imageField = ["Image", "ImageRef", "MultiImage"].includes(o.field_type);
      if ((!imageField || managedField) && !sameField(applied, field.after)) throw new Error("unexpected_response_field");
      if (field.slug && response.fieldData.slug !== field.slug.after) throw new Error("unexpected_response_slug");
      if (managedField || field.slug) {
        const verified = await reader.item(o.collection_id, o.item_id, o.locale);
        if (verified.id !== o.item_id || verified.isArchived || (o.locale && verified.cmsLocaleId !== o.locale) || !sameField(verified.fieldData[o.field_slug], field.after) || (field.slug && verified.fieldData.slug !== field.slug.after)) throw new Error("verification_failed");
      }
      result = { sourceKey: field.sourceKey, status: "applied", message: "Alteração salva no CMS preparado. O site não foi publicado.", actual: applied, ...(field.slug ? { slugActual: field.slug.after } : {}) };
    }
  } catch (error) {
    const permission = error instanceof WebflowError && ["unauthorized", "forbidden"].includes(error.kind);
    const rateLimit = error instanceof WebflowError && error.kind === "rate_limit";
    if (rateLimit) wait = Math.min(86400, Math.max(5, Math.ceil(error.retryAfter ?? 60)));
    const knownRejected = sentThisAttempt && !writeCompleted && (permission || rateLimit);
    result = { sourceKey: field.sourceKey, status: dispatched && !knownRejected ? "uncertain" : "failed", message: permission ? "Reconecte o Webflow com cms:write, vincule o site novamente e prepare outra prévia." : rateLimit ? "O Webflow limitou as chamadas. Aguarde o período indicado pelo provedor antes de preparar outra prévia." : dispatched ? "Não foi possível confirmar a escrita. Confira o campo no Webflow antes de preparar uma nova prévia." : "A fonte ou conexão mudou, ou a leitura falhou. Nenhuma escrita foi enviada para este campo." };
  }
  if (managedField && ["applied", "already_applied"].includes(result.status)) {
    result = { ...result, bindingSource: managedField.nextSource, bindingLocations: managedField.nextLocations };
  }
  return { result, wait };
}
