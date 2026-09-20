import { describe, expect, it } from "vitest";
import { exactSearch, findTextMatches, searchOptionsLabel, searchOptionsSchema } from "./match";
describe("literal text search options", () => {
 it("keeps exact case-sensitive matching by default",()=>{
  expect(findTextMatches('São Paulo, sao paulo, SÃO PAULO','São Paulo').map(m=>m.raw)).toEqual(['São Paulo']);
  expect(findTextMatches('$1.* $1.*','$1.*')).toHaveLength(2);
 });
 it("independently controls case and accent matching",()=>{
  const text='São sao SÃO';
  expect(findTextMatches(text,'sao',{ignoreCase:true}).map(m=>m.raw)).toEqual(['sao']);
  expect(findTextMatches(text,'Sao',{ignoreAccents:true}).map(m=>m.raw)).toEqual(['São']);
  expect(findTextMatches(text,'sao',{ignoreCase:true,ignoreAccents:true}).map(m=>m.raw)).toEqual(['São','sao','SÃO']);
 });
 it("preserves original ranges across emoji and decomposed accents",()=>{
  const source='🎉 CAFÉ e Cafe\u0301!';
  const matches=findTextMatches(source,'cafe',{ignoreCase:true,ignoreAccents:true});
  expect(matches.map(m=>m.raw)).toEqual(['CAFÉ','Cafe\u0301']);
  matches.forEach(m=>expect(source.slice(m.start,m.end)).toBe(m.raw));
  expect(matches[0]?.start).toBe(3);
  expect(findTextMatches('e\u0301','e')).toEqual([]);
 });
 it("uses Unicode word boundaries and avoids substring false positives",()=>{
  expect(findTextMatches('casa casamento casaco casa2 _casa casa_ (casa) casa-casa','casa',{wholeWord:true}).map(m=>m.raw)).toHaveLength(4);
  expect(findTextMatches('São Paulo! São Paulop São Paulo2','sao paulo',{ignoreCase:true,ignoreAccents:true,wholeWord:true})).toHaveLength(1);
  expect(findTextMatches('écasa casaé','casa',{wholeWord:true})).toEqual([]);
 });
 it("returns non-overlapping matches and rejects empty normalized terms",()=>{
  expect(findTextMatches('aaaa','aa').map(m=>m.start)).toEqual([0,2]);
  expect(findTextMatches('anything','\u0301',{ignoreAccents:true})).toEqual([]);
  expect(searchOptionsSchema.parse({})).toEqual(exactSearch);
  expect(()=>searchOptionsSchema.parse({ignoreCase:'true'})).toThrow();
  expect(searchOptionsLabel()).toContain('Diferencia acentos');
 });
});
