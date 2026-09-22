import {expect,it} from 'vitest';
import {shortLocation} from './element-location';
const part=(label:string,section=false,body=false)=>({label,section,body});
it('shows section and text owner, skipping body and intermediate wrappers',()=>{
 expect(shortLocation([part('Body',false,true),part('page-wrapper'),part('hero-section',true),part('container'),part('heading-title')])).toBe('hero-section → heading-title');
});
it('falls back to the main ancestor without repeating a lone element',()=>{
 expect(shortLocation([part('wrapper'),part('container'),part('button')])).toBe('container → button');
 expect(shortLocation([part('heading')])).toBe('heading');
 expect(shortLocation([])).toBe('');
});

it('skips consecutive general wrappers but preserves named content blocks',()=>{
 for(const wrapper of ['page-wrapper','main_wrapper','Site Wrapper','pageWrapper','wrapper']){
  expect(shortLocation([part(wrapper),part('main-wrapper'),part('hero'),part('container'),part('heading')])).toBe('hero → heading');
 }
 expect(shortLocation([part('page-wrapper'),part('hero-wrapper'),part('heading')])).toBe('hero-wrapper → heading');
 expect(shortLocation([part('wrapper'),part('button')])).toBe('button');
 expect(shortLocation([part('page-wrapper',true),part('heading')])).toBe('page-wrapper → heading');
});
