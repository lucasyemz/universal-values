import {afterEach,expect,it,vi} from 'vitest';
import {boundedDesignerRead} from './read-api';
afterEach(()=>vi.useRealTimers());
it('ends a stalled read without automatically retrying',async()=>{
 vi.useFakeTimers();
 const read=vi.fn(()=>new Promise<never>(()=>{}));
 const promise=boundedDesignerRead(read,1000);
 const check=expect(promise).rejects.toThrow('demorou demais');
 await vi.advanceTimersByTimeAsync(1000);await check;
 expect(read).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});
it('preserves real errors and clears timers on successful reads',async()=>{
 vi.useFakeTimers();
 await expect(boundedDesignerRead(async()=>42)).resolves.toBe(42);
 await expect(boundedDesignerRead(async()=>{throw new Error('API failed');})).rejects.toThrow('API failed');
 expect(vi.getTimerCount()).toBe(0);
});
