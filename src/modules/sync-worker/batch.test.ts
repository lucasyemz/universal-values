import {expect,it,vi} from 'vitest';
import {processWorkerBatch,WORKER_BUDGET_MS} from './batch';
it('runs at most three sequential claims with the existing pacing',async()=>{
 let elapsed=0,active=0;const run=vi.fn(async()=>{expect(active++).toBe(0);await Promise.resolve();active--;elapsed+=1000;return {idle:false,status:'applied'};});
 const sleep=vi.fn(async(ms:number)=>{elapsed+=ms;});
 expect(await processWorkerBatch(run,{remaining:()=>WORKER_BUDGET_MS-elapsed,sleep})).toEqual({idle:false,status:'applied',processed:3});expect(run).toHaveBeenCalledTimes(3);expect(sleep.mock.calls).toEqual([[5000],[5000]]);
});
it('does not start another field without the minimum remaining time',async()=>{
 let elapsed=0;const run=vi.fn(async()=>{elapsed+=26000;return {idle:false,status:'applied'};});const sleep=vi.fn();
 expect((await processWorkerBatch(run,{remaining:()=>90000-elapsed,sleep})).processed).toBe(1);expect(sleep).not.toHaveBeenCalled();
 const expired=vi.fn();await processWorkerBatch(expired,{remaining:()=>0});expect(expired).not.toHaveBeenCalled();
});
it('stops on every unsafe/cooldown outcome, idle, completion or infrastructure failure',async()=>{
 for(const status of ['failed','uncertain','conflict','worker_error']){const run=vi.fn(async()=>({idle:false,status}));expect((await processWorkerBatch(run,{remaining:()=>90000})).processed).toBe(1);expect(run).toHaveBeenCalledOnce();}
 const idle=vi.fn(async()=>({idle:true}));expect(await processWorkerBatch(idle,{remaining:()=>90000})).toEqual({idle:true,processed:0});expect(idle).toHaveBeenCalledOnce();
 const done=vi.fn(async()=>({idle:false,status:'already_applied',complete:true}));await processWorkerBatch(done,{remaining:()=>90000});expect(done).toHaveBeenCalledOnce();
 const fail=vi.fn(async()=>{throw new Error('claim failed');});await expect(processWorkerBatch(fail,{remaining:()=>90000})).rejects.toThrow('claim failed');expect(fail).toHaveBeenCalledOnce();
});
