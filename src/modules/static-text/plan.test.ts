import { describe, expect, it } from "vitest";
import { findMentions, preparePlan } from "./plan";

const context = { siteId: "site", pageId: "page", pageName: "Home", rootId: "root" };
describe("static text plans", () => {
  it("finds exact case-sensitive mentions with context and Unicode", () => {
    const nodes = [{ id: "a", text: "😀 minha EMPRESA e EMPRESA. empresa" }];
    const mentions = findMentions(nodes, "EMPRESA");
    expect(mentions).toHaveLength(2);
    expect(mentions[0]?.before).toBe("😀 minha ");
    const plan = preparePlan(context, nodes, "EMPRESA", { [mentions[1]!.key]: "Nova" });
    expect(plan.changes[0]?.after).toBe("😀 minha EMPRESA e Nova. empresa");
  });
  it("removes individual mentions without trimming surrounding spaces", () => {
    const nodes = [{ id: "a", text: "A EMPRESA e EMPRESA!" }];
    const mentions = findMentions(nodes, "EMPRESA");
    const plan = preparePlan(context, nodes, "EMPRESA", Object.fromEntries(mentions.map(item => [item.key, ""])));
    expect(plan.changes[0]?.after).toBe("A  e !");
  });
  it("does not merge text nodes or treat replacements as markup/regex", () => {
    expect(findMentions([{ id: "a", text: "EMP" }, { id: "b", text: "RESA" }], "EMPRESA")).toEqual([]);
    const nodes = [{ id: "a", text: "$1.*" }];
    const mention = findMentions(nodes, "$1.*")[0]!;
    expect(preparePlan(context, nodes, "$1.*", { [mention.key]: "<b>$&</b>" }).changes[0]?.after).toBe("<b>$&</b>");
  });
  it("rejects empty searches, stale selections and unchanged plans", () => {
    expect(() => findMentions([], " ")).toThrow();
    expect(() => preparePlan(context, [{ id: "a", text: "X" }], "X", { stale: "Y" })).toThrow();
    expect(() => preparePlan(context, [{ id: "a", text: "X" }], "X", {})).toThrow();
  });
});

it("previews flexible matches using original offsets without rewriting neighboring text",()=>{
 const options={ignoreCase:true,ignoreAccents:true,wholeWord:true};
 const nodes=[{id:"a",text:"🎉 CAFÉ, Cafe\u0301 e cafeteria"}];
 const mentions=findMentions(nodes,"cafe",options);
 expect(mentions.map(m=>m.text)).toEqual(["CAFÉ","Cafe\u0301"]);
 const plan=preparePlan(context,nodes,"cafe",{[mentions[1]!.key]:"Chá"},1000,options);
 expect(plan.changes[0]?.after).toBe("🎉 CAFÉ, Chá e cafeteria");
 expect(plan.searchOptions).toEqual(options);
});
