import { Skeleton } from "@/components/ui";
export default function DashboardLoading() {
  return <div className="ui-page space-y-8" role="status" aria-label="Carregando conteúdo"><Skeleton className="h-8 w-56" /><Skeleton className="h-4 max-w-md" /><div className="ui-card space-y-5 p-6"><Skeleton className="h-10" /><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div><span className="sr-only">Carregando conteúdo…</span></div>;
}
