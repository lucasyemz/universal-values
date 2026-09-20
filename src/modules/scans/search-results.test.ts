import { describe, expect, it } from "vitest";
import { groupScanResults, type Occurrence } from "./schema";
import { resultsSearchSchema, searchResultGroups } from "./search-results";

describe("search scan results", () => {
  const rows = ["Parceira Acme", "Outra Acme", "Outra empresa"].flatMap((text, index) =>
    [1, 2].map((n) => ({ id: `${index}-${n}`, source_key: `${index}-${n}`, canonical: { type: "text", text }, field_type: "PlainText", source_value: text, raw_match: text, start_pos: 0, end_pos: [...text].length } as Occurrence)));
  const sections = groupScanResults({ plan: [] }, rows, rows);

  it("finds partial text without combining different values or dropping peers", () => {
    const groups = searchResultGroups(sections, "ACME")[0]!.duplicates;
    expect(groups.map((g) => g.label)).toEqual(["Parceira Acme", "Outra Acme"]);
    expect(groups.every((g) => g.occurrences.length === 2)).toBe(true);
    expect(sections[0]!.duplicates).toHaveLength(3);
  });

  it("supports empty and unmatched queries and validates the input", () => {
    expect(searchResultGroups(sections, "")).toBe(sections);
    expect(searchResultGroups(sections, "inexistente")[0]!.duplicates).toEqual([]);
    expect(resultsSearchSchema.parse("  Acme  ")).toBe("Acme");
    expect(resultsSearchSchema.parse(["Acme"])).toBe("");
  });
});

it("finds source names and contextual text without another scan",()=>{
 const rows=[1,2].map(n=>({id:String(n),source_key:String(n),canonical:{type:"text",text:"Acme"},collection_name:"Imóveis",item_name:"São Paulo",field_name:"Descrição",field_type:"PlainText",source_value:"A parceira Acme",raw_match:"Acme",start_pos:11,end_pos:15} as Occurrence));
 const sections=groupScanResults({plan:[]},rows,rows);
 for(const query of ['imoveis','sao paulo','descricao','parceira']) expect(searchResultGroups(sections,query)[0]?.duplicates).toHaveLength(1);
});
it("shows unique targeted matches and keeps spelling variants separate",()=>{
 const rows=['São Paulo','sao paulo'].map((text,n)=>({id:String(n),source_key:String(n),canonical:{type:'text',text}} as Occurrence));
 const scan={plan:[{id:'a'.repeat(24),name:'CMS',types:['text' as const],searchText:'sao paulo',searchOptions:{ignoreCase:true,ignoreAccents:true,wholeWord:false}}]};
 expect(groupScanResults(scan,rows,rows)[0]?.duplicates.map(g=>g.label)).toEqual(['São Paulo','sao paulo']);
 expect(groupScanResults({plan:[]},rows,rows)[0]?.duplicates).toEqual([]);
 expect(groupScanResults(scan,rows,rows)[0]?.groups).toEqual([]);
});
