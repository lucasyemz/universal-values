import { RefreshSupport } from "@/components/support/refresh-button";
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { getText } from '@/i18n/server';
import { supportList,supportThread } from '@/modules/support/service';
import { categoryLabels,statusLabels } from '@/modules/support/schema';
import { TicketForm } from '@/components/support/ticket-form';
import { SiteContext } from '@/components/layout/app-shell';
export async function generateMetadata(){const t=await getText();return {title:t('Ajuda e suporte')};}
const pageNumber=(v:string|undefined)=>v&&/^[1-9]\d{0,5}$/.test(v)?Number(v):1;
export default async function Support({searchParams}:{searchParams:Promise<{page?:string;messages?:string;ticket?:string;question?:string;all?:string}>}){
 const q=await searchParams,t=await getText(),page=pageNumber(q.page),messagePage=pageNumber(q.messages);
 const view=await supportList(page,q.all==='1');
 let thread:Awaited<ReturnType<typeof supportThread>>=null,threadError=false;
 if(q.ticket){if(!/^[1-9]\d{0,14}$/.test(q.ticket))notFound();try{thread=await supportThread(Number(q.ticket),messagePage);}catch{threadError=true;}if(!thread&&!threadError)notFound();}
 return <main className="ui-page"><SiteContext title={t('Ajuda e suporte')}/><header className="mb-6"><h1 className="text-2xl font-semibold">{t('Ajuda e suporte')}</h1><p className="mt-2 text-muted">{t('Use a ajuda no canto da tela ou abra um chamado para dúvidas, problemas e melhorias.')}</p></header>
 <div className="grid items-start gap-6 lg:grid-cols-[minmax(260px,1fr)_2fr]"><section className="ui-card p-5"><div className="mb-4 flex flex-wrap gap-3"><Link prefetch={false} href="/dashboard/support">{t('Meus chamados')}</Link>{view.admin&&<Link prefetch={false} href="/dashboard/support?all=1">{t('Atender todos')}</Link>}<Link prefetch={false} href="/dashboard/support?new=1">{t('Novo chamado')}</Link></div>
 {view.unavailable?<p role="alert">{t('Suporte indisponível neste ambiente. Tente novamente mais tarde.')}</p>:<>{!view.tickets.length&&<p>{t('Nenhum chamado por aqui.')}</p>}<ul className="space-y-3">{view.tickets.map(ticket=><li key={ticket.id}><Link prefetch={false} className="block rounded-lg border p-3" href={'/dashboard/support?ticket='+ticket.id+(q.all==='1'?'&all=1':'')}><strong>#{ticket.id} · {ticket.subject}</strong><span className="mt-1 block text-sm text-muted">{t(categoryLabels[ticket.category])} · {t(statusLabels[ticket.status])}</span></Link></li>)}</ul><nav className="mt-4 flex gap-4">{page>1&&<Link prefetch={false} href={'?page='+(page-1)+(q.all==='1'?'&all=1':'')}>{t('Anterior')}</Link>}{view.more&&<Link prefetch={false} href={'?page='+(page+1)+(q.all==='1'?'&all=1':'')}>{t('Próxima')}</Link>}</nav></>}
 <RefreshSupport/></section>
 <section className="ui-card space-y-5 p-5">{threadError?<p role="alert">{t('Não foi possível carregar o chamado. Tente novamente.')}</p>:thread?<><h2 className="text-xl font-semibold">#{thread.ticket.id} · {thread.ticket.subject}</h2><p>{t(statusLabels[thread.ticket.status])}</p><div className="space-y-3">{thread.messages.map(m=><article key={m.id} className="rounded-lg border p-4"><p className="text-xs text-muted">{t(m.is_staff?'Equipe de suporte':'Cliente')} · {new Date(m.created_at).toLocaleString(t.dateLocale,{timeZone:'UTC'})} UTC · {t(statusLabels[m.status])}</p><p className="mt-2 whitespace-pre-wrap break-words">{m.body}</p></article>)}</div><div className="flex gap-4">{thread.more&&<Link prefetch={false} href={'?ticket='+thread.ticket.id+'&messages='+(messagePage+1)}>{t('Mensagens anteriores')}</Link>}{messagePage>1&&<Link prefetch={false} href={'?ticket='+thread.ticket.id+'&messages='+(messagePage-1)}>{t('Mensagens recentes')}</Link>}</div><TicketForm key={thread.ticket.id+':'+thread.ticket.updated_at} request={randomUUID()} ticket={thread.ticket.id} admin={view.admin} currentStatus={thread.ticket.status}/></>:!view.unavailable?<><h2 className="text-xl font-semibold">{t('Novo chamado')}</h2><TicketForm request={randomUUID()} question={q.question?.slice(0,300)}/></>:<p>{t('O formulário estará disponível quando o suporte estiver configurado.')}</p>}</section></div></main>;
}
