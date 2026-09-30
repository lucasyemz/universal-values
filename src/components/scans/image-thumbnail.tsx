"use client";

import { useText } from "@/i18n/use-text";
import Image from "next/image";
import { useState } from "react";

export function ImageThumbnail({ url, alt, expanded = false }: { url: string; alt: string; expanded?: boolean }) {
  const t = useText();

  const size = expanded ? "h-52 w-full" : "h-14 w-14";
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (failedUrl === url) return <span className={`flex ${size} shrink-0 items-center justify-center rounded border bg-subtle text-center text-xs text-faint`}>{t("Sem prévia")}</span>;
  return <Image unoptimized src={url} alt={alt} width={expanded ? 352 : 56} height={expanded ? 208 : 56} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} className={`${size} shrink-0 rounded border bg-subtle object-contain`} />;
}
