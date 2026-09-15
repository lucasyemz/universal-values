"use client";

export default function DashboardError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-lg px-6 py-16"><h1 className="text-2xl font-semibold">Não foi possível carregar seus dados</h1><p className="mt-4 text-slate-600">Tente novamente. Se o problema persistir, verifique a configuração do banco e as migrations.</p><button onClick={reset} className="mt-6 rounded bg-teal-800 px-4 py-3 text-white">Tentar novamente</button></main>;
}
