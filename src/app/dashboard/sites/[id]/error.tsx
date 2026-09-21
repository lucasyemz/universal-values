"use client";
import Link from "next/link";
import { Notice } from "@/components/ui";
export default function SiteError({ reset }: { reset: () => void }) {
  return <main className="ui-page"><h1 className="text-2xl font-semibold">Não foi possível carregar esta área</h1><Notice tone="danger">Os registros desta página estão temporariamente indisponíveis. Tente carregar novamente; se o problema persistir, confira a conexão do projeto.</Notice><div className="flex gap-3"><button onClick={reset} className="ui-btn ui-btn-primary">Tentar novamente</button><Link href="/dashboard" className="ui-btn">Voltar aos workspaces</Link></div></main>;
}
