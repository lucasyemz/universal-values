import { describe,it,expect } from "vitest";
import { cmsOperationSummary,sitePageNumber } from "./presentation";
const expires_at='2026-01-01T00:00:00Z';
describe('site history presentation',()=>{
  it('does not confuse completed processing with successful changes',()=>{
    expect(cmsOperationSummary({status:'completed',expires_at,results:[{status:'applied'},{status:'failed'},{status:'conflict'}]})).toEqual({verified:1,attention:true,status:'conflict'});
    expect(cmsOperationSummary({status:'completed',expires_at,results:[{status:'already_applied'},{status:'uncertain'}]})).toEqual({verified:1,attention:true,status:'uncertain'});
  });
  it('expires only unconfirmed previews',()=>{
    expect(cmsOperationSummary({status:'preview',expires_at,results:[]}).status).toBe('expired');
    expect(cmsOperationSummary({status:'confirmed',expires_at,results:[]}).status).toBe('confirmed');
    expect(cmsOperationSummary({status:'preview',expires_at,results:[]},0).status).toBe('preview');
  });
  it('keeps pagination bounded and rejects invalid offsets',()=>{
    for(const input of [undefined,'0','-1','999999','no','1.1'])expect(sitePageNumber(input)).toBe(1);
    expect(sitePageNumber('2')).toBe(2);
  });
});
