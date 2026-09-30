import 'server-only';
import { requireUser } from '@/modules/auth/service';
import { getPlanUsage } from '@/modules/plans/service';
import { ticketRow, messageRow } from './schema';
export async function supportList(page:number,all:boolean){
 const {client,user}=await requireUser();
 const admin=(await getPlanUsage()).plan==='admin';
 let query=client.from('support_tickets').select('id,owner_id,category,subject,status,created_at,updated_at').order('id',{ascending:false}).range((page-1)*20,page*20);
 if(!admin||!all)query=query.eq('owner_id',user.id);
 const {data,error}=await query;
 if(error)return {admin,unavailable:true,tickets:[],more:false};
 const rows=ticketRow.array().parse(data);
 return {admin,unavailable:false,tickets:rows.slice(0,20),more:rows.length>20};
}
export async function supportThread(id:number,page:number){
 const {client}=await requireUser();
 const {data,error}=await client.from('support_tickets').select('id,owner_id,category,subject,status,created_at,updated_at').eq('id',id).maybeSingle();
 if(error)throw new Error('Support unavailable');
 if(!data)return null;
 const messages=await client.from('support_messages').select('id,is_staff,body,status,created_at').eq('ticket_id',id).order('id',{ascending:false}).range((page-1)*50,page*50);
 if(messages.error)throw new Error('Support unavailable');
 const rows=messageRow.array().parse(messages.data);
 return {ticket:ticketRow.parse(data),messages:rows.slice(0,50).reverse(),more:rows.length>50};
}
