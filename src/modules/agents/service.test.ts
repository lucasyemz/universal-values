import { it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createAgentService } from './service';
import { checkedPayload } from './contracts';
const scan={id:randomUUID(),site_id:randomUUID(),actor_id:randomUUID(),status:'completed',created_at:'2020-01-01T00:00:00Z',plan:[{id:'a'.repeat(24),name:'Synthetic',types:['link']}],truncated:false,skipped_fields:0};
const url='https://example.com/Offer/#CTA';
const rows=[1,2].map(i=>({id:randomUUID(),scan_id:scan.id,site_id:scan.site_id,collection_id:'a'.repeat(24),collection_name:'Synthetic',item_id:i.toString().repeat(24),item_name:'Item',locale:'',field_slug:'link',field_name:'Link',field_type:'Link',source_value:'',raw_match:url,start_pos:0,end_pos:url.length,canonical:{type:'link',url},source_key:'source'+i,managed_field:true}));
const dataset={scan,number:1,rows,reviews:{scan_id:scan.id,pending:2,reviewed:0,total:2,numeric_singletons:[]}};
it('reuses exact saved matching and never loosens URL equality or fabricates a substring range',async()=>{
 const read=vi.fn(async action=>action==='search_candidates'?[scan]:dataset);const service=createAgentService(read);
 const yes=await service('search_saved_content',{account:'alice',site:'test',query:url});expect(yes.matches).toHaveLength(1);
 const no=await service('search_saved_content',{account:'alice',site:'test',query:url.toLowerCase()});expect(no.matches).toEqual([]);expect(no.message).toBe('no matching saved occurrence');
 const substring=await service('search_saved_content',{account:'alice',site:'test',query:'Offer'});expect(substring.scan).toBeNull();
 expect(read.mock.calls.every(c=>['search_candidates','get_scan_results'].includes(c[0]))).toBe(true);
});
it('preserves Unicode ranges and marks original managed field observations as read only',async()=>{
 const service=createAgentService(async()=>dataset);const result=await service('get_scan_results',{account:'alice',site:'test',scan:1});
 expect(result).toMatchObject({readOnly:true,observation:'original-scan'});
 expect(result.occurrences).toEqual(expect.arrayContaining([expect.objectContaining({range:{start:0,end:url.length,unit:'unicode-code-points'},managedField:true})]));
 expect(JSON.stringify(result)).not.toContain(scan.id);
});
it('rejects malformed public IDs, foreign fields and oversized payloads',async()=>{
 const read=vi.fn();const service=createAgentService(read);
 await expect(service('get_scan_results',{account:'alice',site:'test',scan:randomUUID()})).rejects.toThrow('INVALID_INPUT');
 await expect(service('get_scan_results',{account:'alice',site:'test',scan:1,scanId:scan.id})).rejects.toThrow('INVALID_INPUT');
 expect(read).not.toHaveBeenCalled();expect(()=>checkedPayload({text:'x'.repeat(33000)})).toThrow('RESPONSE_TOO_LARGE');
});
