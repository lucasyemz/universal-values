import { randomUUID } from "node:crypto";
import { expect,it } from "vitest";
import { refreshTextReference } from "./reference-refresh";
import { isCurrentReferenceConflict, referenceConflictState } from "./reference-eligibility";
import { type ManagedBinding } from "./sync-plan";
const binding:ManagedBinding={id:randomUUID(),managed_value_id:randomUUID(),site_id:randomUUID(),workspace_id:randomUUID(),source_key:'source',collection_id:'a'.repeat(24),item_id:'b'.repeat(24),locale:'',field_slug:'description',field_type:'PlainText',source_value:'A Company here',canonical:{type:'text',text:'Company'},locations:[{start:2,end:9,raw:'Company'}],uncertain:false,last_synced_at:null};
it('distinguishes historical references from actionable conflicts without claiming application',()=>{
 expect(referenceConflictState(binding,binding,false)).toBe('current');
 expect(referenceConflictState(binding,{...binding,source_value:'A Company here extra'},false)).toBe('updated');
 expect(referenceConflictState(binding,{...binding,last_synced_at:'2026-09-28T23:00:00Z'},false)).toBe('updated');
 expect(referenceConflictState(binding,{...binding,uncertain:true},false)).toBe('uncertain');
 expect(referenceConflictState(binding,undefined,false)).toBe('removed');
 expect(referenceConflictState(binding,{...binding,id:randomUUID()},false)).toBe('removed');
 expect(referenceConflictState(binding,binding,true)).toBe('archived');
});
it('offers resolution only for the exact current binding, never a refreshed or removed one',()=>{
 expect(isCurrentReferenceConflict(binding,{...binding})).toBe(true);
 for(const current of [undefined,{...binding,last_synced_at:'2026-09-28T23:00:00Z'},{...binding,source_value:'A Company here extra'},{...binding,uncertain:true},{...binding,id:randomUUID()}])expect(isCurrentReferenceConflict(binding,current)).toBe(false);
});
it('preserves added surrounding text and computes Unicode positions',()=>{
 const updated=refreshTextReference(binding,'😀 A Company here, with more details');
 expect(updated.locations).toEqual([{start:4,end:11,raw:'Company'}]);
 expect(updated.canonical).toEqual(binding.canonical);
 expect(binding.source_value).toBe('A Company here');
});
it('does not guess missing, changed or duplicated managed text',()=>{
 for(const source of ['A Different here','Company and Company'])expect(()=>refreshTextReference(binding,source)).toThrow();
 expect(()=>refreshTextReference({...binding,uncertain:true},binding.source_value)).toThrow();
 expect(()=>refreshTextReference({...binding,field_type:'Link'},binding.source_value)).toThrow();
});
it('preserves rich text nodes and rejects attributes and scripts',()=>{
 const rich={...binding,field_type:'RichText' as const,source_value:'<p>Company</p>',locations:[{start:3,end:10,raw:'Company'}]};
 expect(refreshTextReference(rich,'<p>New Company text</p>').locations).toEqual([{start:7,end:14,raw:'Company'}]);
 for(const source of ['<p title="Company">Text</p>','<script>Company</script>'])expect(()=>refreshTextReference(rich,source)).toThrow();
});
