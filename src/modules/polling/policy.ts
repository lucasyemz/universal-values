import type {z} from 'zod';
import type {operationProgressSchema} from '@/modules/scans/progress';
export type OperationProgress=z.infer<typeof operationProgressSchema>;
export function progressDelay(progress:Pick<OperationProgress,'status'|'paused'|'retryAt'>,now=Date.now(),worker?:string):number|null {
 if(progress.status==='completed'||progress.status==='cancelled')return null;
 if(progress.status!=='confirmed'||progress.paused||['waiting','cooldown','stalled','worker_error','attention','missing','unknown'].includes(worker??''))return 60000;
 if(progress.retryAt&&Date.parse(progress.retryAt)>now)return Math.min(60000,Math.max(15000,Date.parse(progress.retryAt)-now));
 return 15000;
}
export function progressChanged(previous:Partial<OperationProgress>,next:OperationProgress) {
 const keys=['status','cursor','total','paused','verified','issues','error','updatedAt'] as const;
 return keys.some(key=>previous[key]!==undefined&&previous[key]!==next[key]);
}
