import {expect,it} from "vitest";
import {filterExplorerItems,explorerItemDate} from "./explorer-presentation";
it('filters loaded items locally without changing the page or source values',()=>{
 const items:Parameters<typeof filterExplorerItems>[0]=[{id:'a',isDraft:false,isArchived:false,fieldData:{name:'Ocean View',price:25}},{id:'b',isDraft:true,isArchived:false,fieldData:{name:'Downtown'}}];
 expect(filterExplorerItems(items,' OCEAN ')).toEqual([items[0]]);
 expect(filterExplorerItems(items,'25')).toEqual([items[0]]);
 expect(filterExplorerItems(items,'missing')).toEqual([]);
 expect(filterExplorerItems(items,'')).toBe(items);expect(items).toHaveLength(2);
});
it('does not invent update dates for older responses',()=>{expect(explorerItemDate(undefined,'en')).toBe('—');expect(explorerItemDate('bad','en')).toBe('—');});
