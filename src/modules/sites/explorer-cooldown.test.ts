import {expect,it} from "vitest";
import {ExplorerCooldowns,retrySeconds} from "./explorer-cooldown";
const scope={actorId:'actor',workspaceId:'workspace',siteId:'site',connectionId:'connection',generation:'gen'};
it('enforces provider delay across collections/sites on the connection and never shortens it',()=>{
 let now=0;const cooldown=new ExplorerCooldowns(()=>now);cooldown.block(scope,30);cooldown.block(scope,2);
 expect(cooldown.remaining({...scope,siteId:'other'})).toBe(30);
 expect(cooldown.remaining({...scope,actorId:'other'})).toBe(0);
 expect(cooldown.remaining({...scope,generation:'new'})).toBe(0);
 now=30_000;expect(cooldown.remaining(scope)).toBe(0);
});
it('uses a bounded minimum wait and safe fallback for missing or invalid retry timing',()=>{expect(retrySeconds(undefined)).toBe(60);expect(retrySeconds(NaN)).toBe(60);expect(retrySeconds(0)).toBe(1);expect(retrySeconds(1.5)).toBe(2);});
