import { expect, it, vi } from "vitest";
import type { SuggestionInput } from "./schema";
import { fillPlaceholderBatch, placeholderTargets, type AiBatchTarget, type BatchProgress } from "./batch";
const context = { collection:"Homes",item:"Golden Acres",field:"Description",original:"Lorem ipsum",surrounding:"",facts:"Bedrooms: 3; City: Recife" };
function target(id:string): AiBatchTarget { return {id,label:id,read:()=>({value:"Lorem ipsum",eligible:true}),apply:vi.fn()}; }
function setup(targets: AiBatchTarget[]) {
 const controller=new AbortController();
 const prepare=vi.fn(async(ids:string[])=>Object.fromEntries(ids.map(id=>[id,{ok:true as const,context:{...context,item:id}}])));
 const suggest=vi.fn<(input: SuggestionInput) => Promise<{ text: string; needsContext: boolean }>>(async()=>({text:"A home in Recife",needsContext:false}));
 const progress=vi.fn<(value:BatchProgress)=>void>();
 return {targets,signal:controller.signal,controller,prepare,suggest,progress,wait:vi.fn(async()=>{})};
}
it("selects only editable placeholders and bounds a batch to twenty",()=>{
 expect(placeholderTargets([target("yes"),{...target("edited"),read:()=>({value:"Lorem ipsum",eligible:false})},{...target("real"),read:()=>({value:"Real text",eligible:true})}]).map(t=>t.id)).toEqual(["yes"]);
 expect(placeholderTargets(Array.from({length:30},(_,i)=>target(String(i))))).toHaveLength(20);
});
it("prepares once and generates separately per item, respecting the interval",async()=>{
 const targets=[target("one"),target("two")],f=setup(targets);
 await fillPlaceholderBatch(f);
 expect(f.prepare).toHaveBeenCalledExactlyOnceWith(["one","two"]);
 expect(f.suggest).toHaveBeenCalledTimes(2);expect(f.wait).toHaveBeenCalledTimes(1);
 expect(f.suggest.mock.calls[0]?.[0]).toMatchObject({item:"one"});
 expect(targets[0]!.apply).toHaveBeenCalledWith("A home in Recife");
 expect(f.progress).toHaveBeenLastCalledWith({total:2,completed:2,filled:2,issues:[]});
});
it("skips insufficient context without consuming generation requests",async()=>{
 const f=setup([target("one")]);f.prepare.mockResolvedValue({one:{ok:true,context:{...context,facts:""}}});
 await fillPlaceholderBatch(f);expect(f.suggest).not.toHaveBeenCalled();
 expect(f.progress.mock.lastCall?.[0].issues).toHaveLength(1);
});
it("preserves an edit made during generation",async()=>{
 const t=target("one"),f=setup([t]);f.suggest.mockImplementation(async()=>{t.read=()=>({value:"My edit",eligible:false});return {text:"AI reply",needsContext:false};});
 await fillPlaceholderBatch(f);expect(t.apply).not.toHaveBeenCalled();
});
it("stops after a provider failure and never retries",async()=>{
 const f=setup([target("one"),target("two")]);f.suggest.mockRejectedValue(new Error("Quota"));
 await fillPlaceholderBatch(f);expect(f.suggest).toHaveBeenCalledTimes(1);expect(f.progress.mock.lastCall?.[0].issues[0]?.message).toBe("Quota");
});
it("discards the in-flight reply and stops remaining work when canceled",async()=>{
 const t=target("one"),f=setup([t,target("two")]);f.suggest.mockImplementation(async()=>{f.controller.abort();return {text:"late",needsContext:false};});
 await fillPlaceholderBatch(f);expect(t.apply).not.toHaveBeenCalled();expect(f.suggest).toHaveBeenCalledTimes(1);
});
