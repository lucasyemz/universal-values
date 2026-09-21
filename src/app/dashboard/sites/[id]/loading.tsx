import { Skeleton } from "@/components/ui";
export default function SiteLoading() {
  return <main className="ui-page" aria-busy="true" aria-label="Carregando área do site"><Skeleton className="mb-3 h-8 w-48" /><Skeleton className="mb-8 h-4 w-72 max-w-full" /><section className="divide-y rounded-xl border bg-white px-5">{[0,1,2,3,4].map(row=><div key={row} className="flex justify-between gap-5 py-6"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-5 w-24" /></div>)}</section><span className="sr-only" role="status">Carregando conteúdo do site…</span></main>;
}
