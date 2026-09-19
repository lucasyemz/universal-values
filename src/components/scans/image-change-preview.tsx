"use client";

import Image from "next/image";
import { useState } from "react";

function Preview({ url, label }: { url: string; label: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  return <figure className="min-w-0 rounded-xl border bg-subtle p-3">
    <figcaption className="mb-3 text-sm font-semibold">{label}</figcaption>
    <div className="relative flex h-52 items-center justify-center overflow-hidden rounded-lg bg-surface">
      {status === "loading" && <span role="status" className="absolute text-xs text-muted">Carregando imagem…</span>}
      {status === "failed" ? <p role="status" className="p-4 text-center text-sm text-muted">Não foi possível carregar a imagem. Confira a URL abaixo.</p> : <Image unoptimized src={url} alt={label} width={480} height={320} loading="lazy" referrerPolicy="no-referrer" onLoad={() => setStatus("loaded")} onError={() => setStatus("failed")} className={`relative h-full w-full object-contain ${status === "loaded" ? "opacity-100" : "opacity-0"}`} />}
    </div>
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 block break-all text-xs text-accent underline underline-offset-4" aria-label={`Abrir ${label.toLowerCase()} em nova aba`}>{url}</a>
  </figure>;
}

export function ImageChangePreview({ before, after }: { before: string; after: string }) {
  return <div className="mt-4 grid gap-4 sm:grid-cols-2" aria-label="Comparação das imagens">
    <Preview key={`before:${before}`} url={before} label="Imagem anterior" />
    <Preview key={`after:${after}`} url={after} label="Nova imagem" />
  </div>;
}
