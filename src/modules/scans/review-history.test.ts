import { expect, it } from "vitest";
import { fixture, id, other } from "./inline-preview.fixture";
import { reviewedChanges, reviewHistorySchema } from "./review-history";
const rows = fixture().occurrences;
const request = (status = "applied", actual: unknown = "New") => reviewHistorySchema.parse({ id, created_at: "2026-09-20", reverts_request_id: null, changes: [{ occurrenceId: id }], results: [{ sourceKey: "source", status, actual }] });
it("shows the verified field instead of the old scan snapshot", () => {
 expect(reviewedChanges(rows, [request()])[id]).toEqual({requestId:id,after:"New",reverted:false,reversible:true});
 expect(rows[0]!.source_value).toBe("Old");
});
it("does not claim failed/conflicting/uncertain or manual reviews were applied", () => {
 for (const status of ["failed","conflict","uncertain"]) expect(reviewedChanges(rows,[request(status)])).toEqual({});
 expect(reviewedChanges(rows,[])).toEqual({});
});
it("uses the newest verified reversal even if input is unordered", () => {
 const revert={...request(),id:other,created_at:"2026-09-21",reverts_request_id:id,results:[{sourceKey:"source",status:"applied",actual:"Old"}]};
 expect(reviewedChanges(rows,[request(),revert])[id]).toEqual({requestId:other,after:"Old",reverted:true,reversible:false});
});
it("preserves empty values and numeric/media representations", () => {
 expect(reviewedChanges(rows,[request("already_applied","")])[id]?.after).toBe("");
 expect(reviewedChanges(rows,[request("applied",2000)])[id]?.after).toBe("2000");
 expect(reviewedChanges(rows,[request("applied",{url:"https://example.com/a.png"})])[id]?.after).toContain("https://example.com/a.png");
});

it("shows the latest failure without replacing a previously verified historical value", async () => {
 const {reviewOutcomes}=await import("./review-history");
 const failed={...request("failed"),id:other,created_at:"2026-09-21",status:"completed"};
 expect(reviewOutcomes(rows,[request(),failed])[id]?.status).toBe("failed");
 expect(reviewedChanges(rows,[request(),failed])[id]?.after).toBe("New");
});
it("ignores unconfirmed drafts and identifies confirmed, cancelled and reverted items", async () => {
 const {reviewOutcomes}=await import("./review-history");
 const pending={...request(),results:[],status:"confirmed"};
 expect(reviewOutcomes(rows,[pending])[id]?.status).toBe("confirmed");
 expect(reviewOutcomes(rows,[{...pending,status:"cancelled"}])[id]?.status).toBe("cancelled");
 expect(reviewOutcomes(rows,[{...pending,status:"preview"}])).toEqual({});
 expect(reviewOutcomes(rows,[{...request(),reverts_request_id:other}])[id]?.status).toBe("reverted");
});

it("limits bulk reversal to visible fields and deduplicates source fields",async()=>{
 const {visibleRevertGroups}=await import("./review-history");
 const all=fixture(false,true).occurrences;
 const h={requestId:id,after:"New",reverted:false,reversible:true};
 expect(visibleRevertGroups(all,{[id]:h,[other]:h},new Set())).toEqual([]);
 expect(visibleRevertGroups([all[0]!,{...all[0]!,id:other}],{[id]:h,[other]:h},new Set([id,other]))).toEqual([{requestId:id,sources:["source"]}]);
 expect(visibleRevertGroups(all,{[id]:h,[other]:h},new Set([id]))).toEqual([{requestId:id,sources:["source"]}]);
 expect(visibleRevertGroups(all,{[id]:h,[other]:{...h,reversible:false}},new Set([id,other]))).toEqual([{requestId:id,sources:["source"]}]);
});

it("shows image comparison only for the explicitly changed, verified occurrence", () => {
 const imageRows=rows.map(o=>({...o,canonical:{type:"image" as const,url:"https://cdn.example/old.png"}}));
 const change={...request(),changes:[{occurrenceId:id,after:{type:"image" as const,url:"https://cdn.example/new.png"}}]};
 expect(reviewedChanges(imageRows,[change])[id]?.image).toEqual({before:"https://cdn.example/old.png",after:"https://cdn.example/new.png"});
 expect(reviewedChanges(imageRows,[{...change,results:[{sourceKey:"source",status:"conflict"}]}])).toEqual({});
});
