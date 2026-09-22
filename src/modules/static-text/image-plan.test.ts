import {expect,it} from "vitest";
import {changedImageCount,prepareImagesPlan,continueImageScan,type ImageGroup} from "./image-plan";
import {imageUrlSchema,imageSnapshot} from "./image-edit";
import {planSchema} from "./plan";
const context={siteId:"s",pageId:"p",rootId:"r",pageName:"Home"};
const asset={id:"new",url:"https://cdn.example/new.png",name:"New"};
const url="https://cdn.example/old.png";
const groups:ImageGroup[]=[{url,name:"Old",occurrences:[1,2,3].map(n=>({id:String(n),targetId:String(n),url,name:"Old",location:"Hero",snapshot:imageSnapshot({kind:"asset",assetId:"old",url,footprint:String(n)})}))}];
it.each([[["1"],1],[["1","3"],2],[["1","2","3"],3]])("prepares exactly selected occurrences %j",(selected,count)=>{
 const plan=prepareImagesPlan(context,groups,{[url]:{selected,asset}});
 expect(plan.changes).toHaveLength(count);expect(plan.changes.map(c=>c.id)).toEqual(selected);
 const next=continueImageScan(groups,{[url]:{selected,asset}},plan);
 expect(next.groups.flatMap(g=>g.occurrences)).toHaveLength(3-count);
});
it("rejects no-op, unknown selections and tampered image previews",()=>{
 expect(()=>prepareImagesPlan(context,groups,{[url]:{selected:["1"],asset:{...asset,url}}})).toThrow();
 expect(()=>prepareImagesPlan(context,groups,{[url]:{selected:["unknown"],asset}})).toThrow();
 const plan=prepareImagesPlan(context,groups,{[url]:{selected:["1"],asset}});
 plan.changes[0]!.image!.asset.url="https://evil.example/other.png";
 expect(planSchema.safeParse(plan).success).toBe(false);
});
it("requires all shared occurrences and writes their target once",()=>{
 const shared=[{...groups[0]!,occurrences:groups[0]!.occurrences.map(o=>({...o,targetId:"shared",snapshot:groups[0]!.occurrences[0]!.snapshot}))}];
 expect(()=>prepareImagesPlan(context,shared,{[url]:{selected:["1"],asset}})).toThrow("compartilhada");
 expect(prepareImagesPlan(context,shared,{[url]:{selected:["1","2","3"],asset}}).changes).toHaveLength(1);
});

it.each([""," ","https:","https://","not a url","https://["])("handles an empty or incomplete URL without crashing: %j",input=>{
 expect(()=>imageUrlSchema.safeParse(input)).not.toThrow();
 expect(imageUrlSchema.safeParse(input).success).toBe(false);
 expect(changedImageCount(groups,{[url]:{selected:["1"],url:input}})).toBe(0);
});
it("enables review again after replacing an invalid URL with a valid image URL",()=>{
 expect(changedImageCount(groups,{[url]:{selected:["1"],url:asset.url}})).toBe(1);
});
