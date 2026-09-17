"use client";
import { Notice, PageHeader, Button } from "@/components/ui";

export default function DashboardError({ reset }: { reset: () => void }) {
  return <main className="ui-page !max-w-2xl"><PageHeader title="Não foi possível carregar seus dados" /><Notice tone="warning">Tente carregar novamente. Suas alterações já confirmadas permanecem registradas.</Notice><Button onClick={reset}>Tentar novamente</Button><details className="mt-6 text-xs text-muted"><summary>Orientação de configuração</summary><p className="mt-2">Se o problema persistir, verifique a conexão, a configuração do banco e as migrations.</p></details></main>;
}
