"use client";
import { useText } from "@/i18n/use-text";
import { Notice, PageHeader, Button } from "@/components/ui";

export default function DashboardError({ reset }: { reset: () => void }) {
  const t = useText();

  return <main className="ui-page !max-w-2xl"><PageHeader title={t("Não foi possível carregar seus dados")} /><Notice tone="warning">{t("Tente carregar novamente. Suas alterações já confirmadas permanecem registradas.")}</Notice><Button onClick={reset}>{t("Tentar novamente")}</Button><details className="mt-6 text-xs text-muted"><summary>{t("Orientação de configuração")}</summary><p className="mt-2">{t("Se o problema persistir, verifique a conexão, a configuração do banco e as migrations.")}</p></details></main>;
}
