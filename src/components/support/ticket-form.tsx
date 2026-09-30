'use client';
import { useActionState,useEffect,useState } from 'react';
import { useRouter } from 'next/navigation';
import { useText } from '@/i18n/use-text';
import { createTicket,reply } from '@/modules/support/actions';
import { categoryLabels,statusLabels } from '@/modules/support/schema';
import { SubmitButton } from '@/components/ui/submit-button';
export function TicketForm({request,ticket,admin=false,question='',currentStatus='open'}:{request:string;ticket?:number;admin?:boolean;question?:string;currentStatus?:string}){
 const [subject,setSubject]=useState(question.slice(0,160)),[body,setBody]=useState(ticket?'':question);
 const t=useText(),router=useRouter();const [result,action,pending]=useActionState(ticket?reply:createTicket,{});
 useEffect(()=>{if(result.ticket){router.push('/dashboard/support?ticket='+result.ticket);router.refresh();}},[result.ticket,router]);
 return <form action={action} className="space-y-4"><input type="hidden" name="request" value={request}/>{ticket?<input type="hidden" name="ticket" value={ticket}/>:<><label className="block">{t('Categoria')}<select name="category" className="mt-1 block w-full">{Object.entries(categoryLabels).map(([k,v])=><option key={k} value={k}>{t(v)}</option>)}</select></label><label className="block">{t('Assunto')}<input name="subject" required minLength={3} maxLength={160} value={subject} onChange={e=>setSubject(e.target.value)} className="mt-1 block w-full"/></label></>}
 <label className="block">{t(ticket?'Resposta':'Descrição')}<textarea name="body" required minLength={1} maxLength={5000} rows={5} value={body} onChange={e=>setBody(e.target.value)} className="mt-1 block w-full"/></label>
 {ticket&&(admin?<label className="block">{t('Status')}<select name="status" defaultValue={currentStatus}>{Object.entries(statusLabels).map(([k,v])=><option key={k} value={k}>{t(v)}</option>)}</select></label>:<input type="hidden" name="status" value="open"/>)}
 <p className="text-xs text-muted">{t('Não envie senhas, tokens ou links de recuperação. As respostas ficam neste chamado, sem notificação por e-mail.')}</p>
 {result.error&&<p role="alert">{t(result.error)}</p>}
 <SubmitButton disabled={pending||!!result.ticket} pendingLabel={t('Enviando…')}>{t(ticket?'Enviar resposta':'Abrir chamado')}</SubmitButton>
 </form>;
}
