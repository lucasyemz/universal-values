import "server-only";
import {requireUser} from '@/modules/auth/service';
// Only call after a successful confirmation transaction. Any acceleration failure
// is deliberately independent of the durable confirmation and its audit.
export async function kickConfirmedOperation(id:string) {
 try{const {client}=await requireUser();await client.rpc('request_cms_worker_kick',{p_id:id});}catch{/* Cron remains the recovery path. */}
}
