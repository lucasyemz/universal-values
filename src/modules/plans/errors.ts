const messages: Record<string, string> = {
  quota_sites: "O plano gratuito permite 1 site Webflow por conta, somando todos os workspaces.",
  quota_scans_month: "Você atingiu os 5 scans deste mês. A cota renova no primeiro dia do próximo mês, às 00h UTC.",
  quota_fields_month: "Esta operação ultrapassa a cota de 50 campos confirmados por mês. Reduza a seleção ou aguarde a renovação.",
  quota_active_operation: "Você já tem uma operação ativa. Conclua ou cancele o scan ou a alteração anterior antes de iniciar outra.",
  quota_scan_items: "O plano gratuito permite ler até 100 itens por scan.",
  quota_requests_month: "Você atingiu o limite mensal de consultas à integração Webflow. Aguarde a renovação da cota.",
  quota_requests_minute: "Muitas solicitações em pouco tempo. Aguarde um minuto antes de tentar novamente.",
  quota_previews_month: "Você atingiu o limite de 200 preparações neste mês. Aguarde a renovação da cota.",
  quota_global_paused: "Novas operações gratuitas estão temporariamente pausadas. Seu histórico permanece disponível.",
  quota_global_capacity: "A capacidade gratuita do aplicativo foi atingida. Novas operações estão temporariamente indisponíveis.",
  quota_global_storage: "O armazenamento reservado ao plano gratuito está no limite. Novas operações estão pausadas.",
};
export function quotaMessage(code: string | undefined) { return code ? messages[code] : undefined; }
export function quotaErrorCode(error: { message?: string } | null | undefined) {
  return error?.message && Object.hasOwn(messages, error.message) ? error.message : undefined;
}
