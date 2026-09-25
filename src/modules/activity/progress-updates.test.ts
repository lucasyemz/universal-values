import {expect,it} from 'vitest';
import {changedOperations} from './progress-updates';
import type {Activity} from './model';
const row:Activity={id:'a',kind:'change',title:'',site:'',href:'',state:'active',label:'queued',detail:'',current:1,total:2};
it('wakes only operations whose observed progress changed, including completion and attention',()=>{
 expect(changedOperations([row],[row])).toEqual([]);
 expect(changedOperations([row],[{...row,current:2,state:'done'}])).toEqual(['a']);
 expect(changedOperations([row],[{...row,state:'attention'}])).toEqual(['a']);
 expect(changedOperations([row],[{...row,label:'cancelled',state:'done'}])).toEqual(['a']);
 expect(changedOperations([row],[{...row,kind:'scan',current:2}])).toEqual([]);
 expect(changedOperations([row],[{...row,id:'b'}])).toEqual(['b']);
});
it('unchanged follow-up observations do not create a refresh loop',()=>{
 const completed={...row,state:'done' as const,current:2};
 expect(changedOperations([completed],[completed])).toEqual([]);
});
