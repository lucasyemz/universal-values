'use server';
import { requireUser } from '@/modules/auth/service';
import { newTicket,replyTicket } from './schema';
import { revalidatePath } from 'next/cache';
export type SupportResult={error?:string;ticket?:number};
function failure(message:string|undefined):SupportResult{
 return {error:message==='SUPPORT_RATE'?'Muitas solicitações. Tente novamente mais tarde.':message==='SUPPORT_DENIED'?'Chamado indisponível para esta conta.':'Não foi possível enviar. Seus dados continuam no formulário; tente novamente.'};
}
export async function createTicket(_previous:SupportResult,form:FormData):Promise<SupportResult>{
 const input=newTicket.safeParse(Object.fromEntries(form));
 if(!input.success)return {error:'Confira o assunto, a categoria e a descrição.'};
 const {client}=await requireUser();const v=input.data;
 const {data,error}=await client.rpc('create_support_ticket',{p_request:v.request,p_category:v.category,p_subject:v.subject,p_body:v.body});
 if(error||!data)return failure(error?.message);
 revalidatePath('/dashboard/support');return {ticket:data};
}
export async function reply(_previous:SupportResult,form:FormData):Promise<SupportResult>{
 const input=replyTicket.safeParse(Object.fromEntries(form));
 if(!input.success)return {error:'Confira a resposta e o status.'};
 const {client}=await requireUser();const v=input.data;
 const {data,error}=await client.rpc('reply_support_ticket',{p_request:v.request,p_ticket:v.ticket,p_body:v.body,p_status:v.status});
 if(error||!data)return failure(error?.message);
 revalidatePath('/dashboard/support');return {ticket:data};
}
