import { it,expect } from 'vitest';
import { parseScanSetup,scanCollectionsValid } from './setup-form';
function setup(){const form=new FormData();form.set('id','11111111-1111-4111-8111-111111111111');form.set('siteId','22222222-2222-4222-8222-222222222222');form.set('source','cms');form.append('collectionIds','a'.repeat(24));return form;}
it('keeps both steps and text options in the preview payload',()=>{
  const form=setup();form.set('searchText','Maecenas');form.append('types','link');form.set('ignoreCase','on');form.set('wholeWord','on');
  const result=parseScanSetup(form);expect(result.success).toBe(true);
  if(result.success){expect(result.data.types).toEqual(['link','text']);expect(result.data.collectionIds).toEqual(['a'.repeat(24)]);expect(result.data.searchOptions).toEqual({ignoreCase:true,ignoreAccents:false,wholeWord:true});}
});
it('preserves no-selection validation and collection limits',()=>{
  const form=setup();expect(parseScanSetup(form).success).toBe(false);expect(scanCollectionsValid(form)).toBe(true);
  form.delete('collectionIds');expect(scanCollectionsValid(form)).toBe(false);
  for(let i=0;i<21;i++)form.append('collectionIds','a'.repeat(24));expect(scanCollectionsValid(form)).toBe(false);
});
it('allows a standalone placeholder scan and preserves its mode',()=>{
 const form=setup();form.set('placeholders','on');
 const parsed=parseScanSetup(form);expect(parsed.success).toBe(true);
 if(parsed.success){expect(parsed.data.placeholders).toBe(true);expect(parsed.data.types).toEqual(['text']);}
});
