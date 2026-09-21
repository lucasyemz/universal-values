import { expect,it } from "vitest";
import { detectPlaceholders } from "./placeholders";
import { detectPage } from "./detect";
import { groupScanResults, type Occurrence } from "./schema";
import { isRepeatedGroupSelection } from "./changes";
import { buildFieldChanges } from "./change-plan";
const collection={id:"a".repeat(24),displayName:"CMS",slug:"cms",fields:[{id:"description",slug:"description",displayName:"Description",type:"RichText"}]};
function rows(source:string){return detectPage(collection,{items:[{id:"b".repeat(24),isDraft:false,isArchived:false,fieldData:{description:source}}],pagination:{offset:0,limit:25,total:1}},["text"],undefined,undefined,true).rows.map((row,index)=>({...row,id:`11111111-1111-4111-8111-${String(index).padStart(12,"0")}`,source_key:"field"})) as Occurrence[];}
it.each(["Lorem ipsum dolor sit amet.","SAMPLE TEXT for this page","Texto de exemplo para o produto","Dummy text"])("detects a standalone placeholder: %s",value=>{expect(detectPlaceholders(value,false)).toHaveLength(1);});
it("keeps long placeholders beyond the normal automatic text limit",()=>{const value="Lorem ipsum "+"dolor ".repeat(80);expect(detectPlaceholders(value,false)[0]?.raw).toBe(value.trim());});
it("does not match regular prose, attributes or hidden/script content",()=>{
 expect(detectPlaceholders("A house in Recife with three bedrooms.",false)).toEqual([]);
 expect(detectPlaceholders('<p title="Lorem ipsum">A real description</p><script>Lorem ipsum</script><style>Lorem ipsum</style>',true)).toEqual([]);
});
it("keeps unique results visible and editable while preserving rich text headings",()=>{
 const found=rows('<h2>Lorem ipsum dolor sit amet</h2><p>Real description</p>');expect(found).toHaveLength(1);
 const sections=groupScanResults({plan:[{id:collection.id,name:"CMS",types:["text"],placeholders:true}]},found,found);
 expect(sections[0]?.duplicates).toHaveLength(1);expect(isRepeatedGroupSelection(found,[found[0]!.id],true)).toBe(true);
 const changes=buildFieldChanges(found,[{occurrenceId:found[0]!.id,after:{type:"text",text:"New heading"}}]);
 expect(changes[0]?.after).toBe('<h2>New heading</h2><p>Real description</p>');
});
it("uses Unicode-safe ranges and preserves formatting outside matches",()=>{
 const source='<p>🏠 Real text</p><p> Lorem ipsum &amp; dolor </p>';
 const result=detectPlaceholders(source,true)[0]!;
 expect([...source].slice(result.start,result.end).join("")).toBe(result.raw);
});
it("leaves regular duplicate detection unchanged when the option is off",()=>{
 const found=rows('<p>Lorem ipsum</p>');
 expect(groupScanResults({plan:[{id:collection.id,name:"CMS",types:["text"]}]},found,found)[0]?.duplicates).toEqual([]);
});
