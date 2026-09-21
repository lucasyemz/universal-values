import { expect,it } from "vitest";
import { buildAiContext } from "./context";
import { occurrenceSchema } from "@/modules/scans/schema";
const id="11111111-1111-4111-8111-111111111111",collectionId="a".repeat(24),itemId="b".repeat(24);
const original="Lorem ipsum";
const occurrence=occurrenceSchema.parse({id,scan_id:id,site_id:id,source_key:"key",collection_id:collectionId,collection_name:"CMS",item_id:itemId,item_name:"House",locale:"",field_slug:"description",field_name:"Description",field_type:"RichText",source_value:"<h2>Lorem ipsum</h2>",raw_match:original,start_pos:4,end_pos:15,canonical:{type:"text",text:original}});
const collection={id:collectionId,displayName:"Properties",slug:"properties",fields:[{id:"d",slug:"description",displayName:"Description",type:"RichText"},{id:"n",slug:"name",displayName:"Name",type:"PlainText"},{id:"b",slug:"beds",displayName:"Bedrooms",type:"Number"},{id:"p",slug:"placeholder",displayName:"Example",type:"PlainText"},{id:"a",slug:"about",displayName:"About",type:"RichText"},{id:"l",slug:"link",displayName:"Link",type:"Link"}]};
const item={id:itemId,isArchived:false,isDraft:false,fieldData:{description:occurrence.source_value,name:"House",beds:3,placeholder:"Lorem ipsum dolor sit amet",about:"<p>Located in Recife</p><script>secret_script</script>",link:"https://example.com?secret=abc"}};
it("extracts bounded facts from this item, strips HTML and omits placeholder/link data",()=>{
 const result=buildAiContext(occurrence,collection,item);
 expect(result.facts).toContain("Bedrooms: 3");expect(result.facts).toContain("Located in Recife");expect(result.facts).not.toMatch(/<|secret|Lorem ipsum/);expect(result.original).toBe(original);
 expect(result.surrounding).toBe("[TRECHO A SUBSTITUIR]");
});
it("rejects changed text, archived items, wrong item, collection, locale and schema",()=>{
 expect(()=>buildAiContext(occurrence,collection,{...item,fieldData:{...item.fieldData,description:"new"}})).toThrow();
 expect(()=>buildAiContext(occurrence,collection,{...item,isArchived:true})).toThrow();
 expect(()=>buildAiContext(occurrence,collection,{...item,id:"c".repeat(24)})).toThrow();
 expect(()=>buildAiContext(occurrence,{...collection,id:"c".repeat(24)},item)).toThrow();
 expect(()=>buildAiContext(occurrence,collection,{...item,cmsLocaleId:"other"})).toThrow();
 expect(()=>buildAiContext(occurrence,{...collection,fields:[]},item)).toThrow();
});
it("leaves facts empty when the item only contains placeholder content",()=>{
 const result=buildAiContext(occurrence,collection,{...item,fieldData:{description:occurrence.source_value,name:"Lorem ipsum",placeholder:"Lorem ipsum dolor sit amet"}});
 expect(result.facts).toBe("");
});
