import Link from "next/link";
import { randomUUID } from "node:crypto";
import { SitePage } from "@/components/sites/site-page";
import { Notice } from "@/components/ui";
import { FreshLink } from "@/components/ui/fresh-link";
import { NewScanWizard } from "@/components/sites/new-scan-wizard";
import { getScanSite, loadScanCollections } from "@/modules/scans/service";

export default async function NewScanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id }=await params, { error }=await searchParams,site=await getScanSite(id);
  const collections=await loadScanCollections(id).catch(()=>null);
  return <SitePage site={site} title="Novo scan" description="Escolha onde buscar e o que encontrar. Você revisará o escopo antes de iniciar.">
    <div className="mb-5"><FreshLink href={`/dashboard/sites/${id}/scans`}>← Voltar aos scans</FreshLink></div>
    {error && <Notice tone="danger" title="Não foi possível preparar o scan">{error==='scope'?'Selecione de 1 a 20 coleções e pelo menos um tipo ou texto específico.':'Confira a conexão com o Webflow e tente preparar a prévia novamente.'}</Notice>}
    {collections===null ? <Notice tone="danger" title="Não foi possível ler as coleções">A configuração do scan depende da conexão Webflow. <FreshLink href={`/dashboard/sites/${id}/scans/new`}>Tentar novamente</FreshLink> ou <Link className="underline" href={`/dashboard/connections/${site.connection_id}`}>conferir conexão</Link>.</Notice> : <NewScanWizard siteId={id} operationId={randomUUID()} collections={collections} />}
  </SitePage>;
}
