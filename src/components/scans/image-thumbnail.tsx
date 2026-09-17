"use client";

import Image from "next/image";
import { useState } from "react";

export function ImageThumbnail({ url, alt }: { url: string; alt: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (failedUrl === url) return <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded border bg-slate-50 text-center text-[10px] text-slate-500">Sem prévia</span>;
  return <Image unoptimized src={url} alt={alt} width={56} height={56} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} className="h-14 w-14 shrink-0 rounded border bg-slate-50 object-contain" />;
}
