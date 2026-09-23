export const WORKER_BUDGET_MS=90000;
export const WORKER_MAX_FIELDS=3;
const NEXT_FIELD_RESERVE_MS=60000;
const FIELD_GAP_MS=5000;
type Turn={idle:boolean;status?:string;complete?:boolean};
// Every run is a new authoritative claim + ordinary per-field executor, awaited
// to completion. No writes are fanned out and no scheduling timestamp is bypassed.
export async function processWorkerBatch(run:()=>Promise<Turn>,options:{remaining:()=>number;sleep?:(ms:number)=>Promise<void>}) {
 const sleep=options.sleep??(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
 let processed=0,last:Turn|undefined;
 while(processed<WORKER_MAX_FIELDS){
  if(options.remaining()<NEXT_FIELD_RESERVE_MS+(processed?FIELD_GAP_MS:0))break;
  if(processed)await sleep(FIELD_GAP_MS);
  if(options.remaining()<NEXT_FIELD_RESERVE_MS)break;
  const result=await run();
  if(result.idle)break;
  last=result;processed++;
  if(result.complete||!['applied','already_applied'].includes(result.status??''))break;
 }
 return {idle:processed===0,processed,...(last?.status?{status:last.status}:{})};
}
