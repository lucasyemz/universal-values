import { expect,it } from "vitest";
import { inlinePreview } from "./inline-preview";
import { fixture } from "./inline-preview.fixture";
it("shows the full exact field changes for individual and batch edits",()=>{
 const one=inlinePreview(fixture()),batch=inlinePreview(fixture(false,true));
 expect(one).toMatchObject({fieldCount:1,itemCount:1,slugCount:0});expect(one.fields[0]).toMatchObject({before:"Old",after:"New"});
 expect(batch).toMatchObject({fieldCount:2,itemCount:2});
});
it("includes paired slug side effects in the receipt and field count",()=>{
 const view=fixture(true),first=inlinePreview(view);expect(first).toMatchObject({fieldCount:2,itemCount:1,slugCount:1});
 view.plan[0]!.slug!.after="different";expect(inlinePreview(view).digest).not.toBe(first.digest);
 delete view.plan[0]!.slug;expect(()=>inlinePreview(view)).toThrow("slug");
});
it("invalidates changed content but keeps the receipt stable for confirmation retries",()=>{
 const view=fixture(),first=inlinePreview(view);view.request.status="completed";expect(inlinePreview(view).digest).toBe(first.digest);
 view.plan[0]!.after="Changed";expect(inlinePreview(view).digest).not.toBe(first.digest);
});
