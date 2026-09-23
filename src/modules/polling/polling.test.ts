import {afterEach,expect,it,vi} from 'vitest';
import {createPoller} from './scheduler';
import {progressChanged,progressDelay,type OperationProgress} from './policy';
const progress:OperationProgress={status:'confirmed',cursor:0,total:2,verified:0,issues:0,paused:false,error:null,queuePosition:1,retryAt:null,updatedAt:'now'};
afterEach(()=>vi.useRealTimers());
it('refreshes only meaningful progress; paused/cooldown slow down and terminal stops',()=>{
 expect(progressChanged(progress,{...progress,queuePosition:2})).toBe(false);
 for(const next of [{...progress,cursor:1},{...progress,updatedAt:'next'},{...progress,paused:true},{...progress,status:'completed' as const}])expect(progressChanged(progress,next)).toBe(true);
 expect(progressDelay(progress)).toBe(15000);expect(progressDelay({...progress,paused:true})).toBe(60000);expect(progressDelay({...progress,retryAt:new Date(Date.now()+120000).toISOString()})).toBe(60000);expect(progressDelay({...progress,status:'completed'})).toBeNull();
});
it('serializes requests, pauses hidden/offline and stops immediately at completion',async()=>{
 vi.useFakeTimers();let enabled=true;const run=vi.fn<()=>Promise<number|null>>().mockResolvedValue(15000);const p=createPoller(run,()=>enabled);
 p.wake();await vi.advanceTimersByTimeAsync(15000);expect(run).toHaveBeenCalledTimes(2);
 enabled=false;p.wake();await vi.advanceTimersByTimeAsync(60000);expect(run).toHaveBeenCalledTimes(2);
 enabled=true;run.mockResolvedValue(null);p.wake();await vi.advanceTimersByTimeAsync(60000);p.wake();expect(run).toHaveBeenCalledTimes(3);p.stop();
});
it('coalesces wake events during a request and discards work after disposal',async()=>{
 vi.useFakeTimers();let finish!:(n:number)=>void;const run=vi.fn(()=>new Promise<number>(resolve=>{finish=resolve;}));const p=createPoller(run,()=>true);
 p.wake();p.wake();p.wake();expect(run).toHaveBeenCalledTimes(1);finish(15000);await Promise.resolve();expect(run).toHaveBeenCalledTimes(2);p.stop();finish(15000);await vi.advanceTimersByTimeAsync(60000);expect(run).toHaveBeenCalledTimes(2);
});

it('activity uses fast polling for active work only, not completed/attention history',async()=>{
 const {activityDelay}=await import('@/modules/activity/polling');
 const base={id:'id',kind:'change' as const,title:'CMS',site:'Site',href:'/',label:'',detail:'',current:0};
 expect(activityDelay([])).toBe(60000);
 expect(activityDelay([{...base,state:'attention'},{...base,state:'done'}])).toBe(60000);
 expect(activityDelay([{...base,state:'attention'},{...base,state:'active'}])).toBe(15000);
});
