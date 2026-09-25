import { expect,it } from "vitest";
import { readDesignerSession,saveDesignerSession,clearDesignerSession } from "./session-storage";
function storage() { const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}}; }
const session={code:"uvd_"+"a".repeat(64),site:"site-a",expiresAt:"2026-10-20T00:00:00.000Z"};
it("persists a site-bound capability across reloads without extending its expiry",()=>{const store=storage();saveDesignerSession(store,session);expect(readDesignerSession(store,Date.parse("2026-10-19"))).toEqual(session);expect(readDesignerSession(store,Date.parse(session.expiresAt))).toBeNull();expect(readDesignerSession(store,0)).toBeNull();});
it("removes the saved capability on disconnect",()=>{const store=storage();saveDesignerSession(store,session);clearDesignerSession(store);expect(readDesignerSession(store,0)).toBeNull();});
it("rejects malformed or unavailable storage",()=>{expect(readDesignerSession({getItem:()=>'{"code":"invalid"}',removeItem:()=>{}},0)).toBeNull();expect(readDesignerSession({getItem:()=>{throw new Error("disabled");},removeItem:()=>{}},0)).toBeNull();});

import {readScopedDesignerSession,saveScopedDesignerSession,clearScopedDesignerSession} from './session-storage';
const origin='https://dashboard.example';
it('keeps sessions for two sites across reloads and isolates dashboard origins',()=>{
 const store=storage(),other={...session,site:'site-b',code:'uvd_'+'b'.repeat(64)};
 saveScopedDesignerSession(store,{site:session.site,origin},session);
 saveScopedDesignerSession(store,{site:other.site,origin},other);
 expect(readScopedDesignerSession(store,{site:session.site,origin},0)).toEqual(session);
 expect(readScopedDesignerSession(store,{site:other.site,origin},0)).toEqual(other);
 expect(readScopedDesignerSession(store,{site:session.site,origin:'https://other.example'},0)).toBeNull();
 clearScopedDesignerSession(store,{site:other.site,origin});
 expect(readScopedDesignerSession(store,{site:session.site,origin},0)).toEqual(session);
});
it('migrates the matching legacy session without renewal or deleting another site',()=>{
 const store=storage();saveDesignerSession(store,session);
 expect(readScopedDesignerSession(store,{site:'site-b',origin},0)).toBeNull();
 expect(readScopedDesignerSession(store,{site:session.site,origin},0)).toEqual(session);
 expect(readDesignerSession(store,0)).toBeNull();
 expect(readScopedDesignerSession(store,{site:session.site,origin},Date.parse(session.expiresAt))).toBeNull();
});
it('does not accept a session under another site scope',()=>{
 expect(()=>saveScopedDesignerSession(storage(),{site:'site-b',origin},session)).toThrow('outro site');
});
