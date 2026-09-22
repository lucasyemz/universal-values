"use client";

import { useText } from "@/i18n/use-text";

export function AppLimitations() {
  const t = useText();
  return <div className="mt-3">
    <p className="font-medium">{t("Limitações atuais")}</p>
    <ul className="mt-2 list-disc space-y-2 pl-4 leading-6">
      <li>{t("A edição de páginas estáticas exige a extensão CopyReplace ativa no Webflow Designer.")}</li>
      <li>{t("Não é possível ler o conteúdo de embeds.")}</li>
      <li>{t("A análise de SEO ainda não está disponível.")}</li>
    </ul>
  </div>;
}
