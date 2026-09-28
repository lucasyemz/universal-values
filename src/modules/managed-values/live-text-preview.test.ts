import {expect,it} from "vitest";
import {liveTextComparison,type LiveTextSource} from "./live-text-preview";
it("updates only bound Unicode ranges immediately, preserving identical unbound text",()=>{
 const source:LiveTextSource={sourceKey:"one",fieldType:"PlainText",source:"😀 Old and Old",locations:[{start:2,end:5,raw:"Old"}]};
 expect(liveTextComparison(source,"New company")).toEqual({before:"😀 Old and Old",after:"😀 New company and Old"});
 expect(source.source).toBe("😀 Old and Old");
 expect(liveTextComparison(source,"Newest")).toEqual({before:source.source,after:"😀 Newest and Old"});
});
it("escapes rich text exactly like execution and preserves markup",()=>{
 expect(liveTextComparison({sourceKey:"one",fieldType:"RichText",source:"<p>Old</p>",locations:[{start:3,end:6,raw:"Old"}]},"A & B")).toEqual({before:"<p>Old</p>",after:"<p>A &amp; B</p>"});
});
it("does not fabricate a preview for stale or overlapping ranges",()=>{
 const source:LiveTextSource={sourceKey:"one",fieldType:"PlainText",source:"Old",locations:[{start:0,end:3,raw:"Other"}]};
 expect(liveTextComparison(source,"New")).toBeNull();
 expect(liveTextComparison({...source,locations:[{start:0,end:3,raw:"Old"},{start:0,end:3,raw:"Old"}]},"New")).toBeNull();
});
