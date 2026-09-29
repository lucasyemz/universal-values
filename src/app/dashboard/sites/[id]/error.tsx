"use client";
import { useText } from "@/i18n/use-text";
import Link from "next/link";
import { Notice, PageHeader } from "@/components/ui";
export default function SiteError({ reset }: { reset: () => void }) {
  const t = useText();

  return <main className="ui-page"><PageHeader title={t("Não foi possível carregar esta área")}/><Notice tone="danger">{t("Os registros desta página estão temporariamente indisponíveis. Tente carregar novamente; se o problema persistir, confira a conexão do projeto.")}</Notice><div className="flex gap-3"><button onClick={reset} className="ui-btn ui-btn-primary">{t("Tentar novamente")}</button><Link href="/dashboard" className="ui-btn">{t("Voltar aos workspaces")}</Link></div></main>;
}
