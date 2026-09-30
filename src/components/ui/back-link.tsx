"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useText } from "@/i18n/use-text";

/** Follow the actual browser history; direct/new-tab visits retain a useful destination. */
export function BackLink({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();
  const t = useText();
  return <a href={fallbackHref} className="ui-btn" onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (window.history.length > 1) {
      event.preventDefault();
      router.back();
    }
  }}><ArrowLeft size={16} aria-hidden="true" />{t("Voltar")}</a>;
}
