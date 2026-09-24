import { explorerScopeKey, type ExplorerScope } from "./explorer-scope";
export const EXPLORER_PAGE_TTL=120_000;
export const EXPLORER_MAX_PAGES=12;
export type ExplorerPage={scope:ExplorerScope;collectionId:string;offset:number;locale:string;structureVersion:string|null};
export function explorerPageKey(page:ExplorerPage) {
 return JSON.stringify([explorerScopeKey(page.scope),page.collectionId,page.offset,page.locale,page.structureVersion]);
}
/** Owned by one mounted Explorer. Never persists content or substitutes for authorization. */
export class ExplorerSession<T> {
 private pages=new Map<string,{value:T;expires:number}>();
 private flights=new Map<string,Promise<T>>();
 private revision=0;
 constructor(private now:()=>number=Date.now) {}
 clear() {this.revision++;this.pages.clear();this.flights.clear();}
 get(page:ExplorerPage) {
  const key=explorerPageKey(page),entry=this.pages.get(key);
  if(!entry)return undefined;
  if(entry.expires<=this.now()){this.pages.delete(key);return undefined;}
  this.pages.delete(key);this.pages.set(key,entry);
  return entry.value;
 }
 async load(page:ExplorerPage,fetchPage:()=>Promise<T>,cacheable:(value:T)=>boolean):Promise<T> {
  const cached=this.get(page);if(cached!==undefined)return cached;
  const key=explorerPageKey(page),existing=this.flights.get(key);
  if(existing)return existing;
  const revision=this.revision;
  const pending=fetchPage().then(value=>{
   if(revision===this.revision&&cacheable(value)) {
    this.pages.set(key,{value,expires:this.now()+EXPLORER_PAGE_TTL});
    while(this.pages.size>EXPLORER_MAX_PAGES)this.pages.delete(this.pages.keys().next().value!);
   }
   return value;
  });
  this.flights.set(key,pending);
  try{return await pending;}finally{if(this.flights.get(key)===pending)this.flights.delete(key);}
 }
}
