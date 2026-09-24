import {type ExplorerScope} from "./explorer-scope";
export function retrySeconds(value:number|undefined) {return value!==undefined&&Number.isFinite(value)?Math.max(1,Math.ceil(value)):60;}
/** Bounded, best-effort process guard. Does not cache authorization or credentials. */
export class ExplorerCooldowns {
 private until=new Map<string,number>();
 constructor(private now:()=>number=Date.now) {}
 private key(scope:ExplorerScope){return JSON.stringify([scope.actorId,scope.workspaceId,scope.connectionId,scope.generation]);}
 remaining(scope:ExplorerScope){return Math.max(0,Math.ceil(((this.until.get(this.key(scope))??0)-this.now())/1000));}
 block(scope:ExplorerScope,seconds:number){
  for(const [key,until] of this.until)if(until<=this.now())this.until.delete(key);
  const key=this.key(scope);
  this.until.set(key,Math.max(this.until.get(key)??0,this.now()+retrySeconds(seconds)*1000));
  while(this.until.size>1000)this.until.delete(this.until.keys().next().value!);
 }
}
