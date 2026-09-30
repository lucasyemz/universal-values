import { WebflowError } from "@/connectors/webflow/client";
import { quotaErrorCode, quotaMessage } from "@/modules/plans/errors";

export class SiteConnectionError extends Error {
  constructor(public readonly reason: string) { super(reason); }
}
export function connectionFailure(error: unknown): string {
  if (error instanceof SiteConnectionError) return error.reason;
  if (error instanceof WebflowError) return "provider_" + error.kind;
  return "unavailable";
}
export function persistenceFailure(error: { code?: string; message?: string }, stage: "prepare" | "confirm") {
  const quota = quotaErrorCode(error);
  if (quota) return new SiteConnectionError(quota);
  if (error.code === "42501") return new SiteConnectionError("access_denied");
  if (error.code === "PGRST202" || error.code === "42883") return new SiteConnectionError("schema_unavailable");
  return new SiteConnectionError(stage + "_failed");
}
export function connectionFeedback(reason: string) {
  return "?error=site-connection&reason=" + encodeURIComponent(reason);
}

export function connectionErrorMessage(reason?: string): string {
  const messages: Record<string, string> = {
    other_workspace: "Este site já está em outro workspace da sua conta. Use Transferir site para movê-lo.",
    access_denied: "Sua conta não tem permissão para concluir o vínculo neste workspace.",
    schema_unavailable: "O banco está sem uma função necessária para conectar o site.",
    no_sites: "O Webflow não retornou sites nesta autorização. Conecte novamente e selecione um site.",
    provider_forbidden: "O Webflow negou a leitura dos sites. Confira a permissão sites:read do app de conexão.",
    provider_unauthorized: "A autorização do Webflow não é mais válida. Conecte novamente.",
    provider_rate_limit: "O Webflow limitou as consultas. Aguarde antes de tentar novamente.",
    prepare_failed: "Não foi possível preparar o vínculo do site no banco.",
    confirm_failed: "Não foi possível salvar o vínculo do site no banco.",
    invalid_result: "O banco retornou um resultado inesperado ao conectar o site.",
  };
  return quotaMessage(reason) ?? messages[reason ?? ""] ?? "Não foi possível concluir a conexão. Tente novamente.";
}
