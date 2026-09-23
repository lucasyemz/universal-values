import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {queryDatabase,tenant,savedScan,asActor} from './phase-b-fixture';
import {summarizeDesignerChange} from '../../src/modules/static-text/history';
import {cmsOperationSummary} from '../../src/modules/sites/presentation';
import {activityRowSchema,encodeActivityCursor,decodeActivityCursor} from '../../src/modules/sites/activity-page';
it('matches static/CMS summaries, keeps RLS and stable forward/backward mixed pagination',async()=>{
 const db=await queryDatabase();try{
 const t=await tenant(db),foreign=await tenant(db),scan=await savedScan(db,t,2),session=randomUUID(),id=randomUUID();
 await db.query("insert into app_private.admins(user_id,reason) values($1,'Fixture')",[t.actor]);
 await db.query("insert into public.designer_sessions(id,site_id,actor_id,token_hash) values($1,$2,$3,$4)",[session,t.site,t.actor,'a'.repeat(64)]);
 const plan={id:randomUUID(),context:{siteId:'site',pageId:'page',pageName:'Home',rootId:'root'},expiresAt:Date.now()+3600000,changes:[{id:'a',before:'old',after:'new'},{id:'b',before:'old',after:'new'}]};
 await db.query("insert into public.designer_changes(id,site_id,actor_id,session_id,search_text,plan,events) values($1,$2,$3,$4,'old',$5,'[]')",[id,t.site,t.actor,session,JSON.stringify(plan)]);
 const event=(status:string,nodeId?:string,observed?:string)=>({plan,status,nodeId,observed,at:new Date().toISOString(),confirmedAt:new Date().toISOString()});
 const scenarios=[[],[event('confirmed')],[event('applied','a','new')],[event('applied','a','new'),event('already_applied','b','new')],[event('applied','a')],[event('applied','a','old')],[event('conflict','a')],[event('dispatching','a')],[event('uncertain','a')],[event('conflict','a'),event('applied','a','new')],[{...event('applied','a','new'),plan:{...plan,id:randomUUID()}}]];
 for(const events of scenarios){
 await db.query('update public.designer_changes set events=$2 where id=$1',[id,JSON.stringify(events)]);
 await asActor(db,t.actor,async()=>{
 const raw=await db.query<{expires_at:Date}>('select expires_at from public.designer_changes where id=$1',[id]);
 const summary=summarizeDesignerChange({plan,events,expires_at:raw.rows[0]!.expires_at.toISOString()});
 const actual=(await db.query<{label:string;verified:number;attention:boolean}>('select * from public.site_change_summaries where id=$1',[id])).rows[0]!;
 expect(actual.label).toBe(summary.status);expect(actual.verified).toBe(summary.verified);
 expect(actual.attention).toBe(summary.changes.some(c=>['conflict','uncertain','dispatching','reported'].includes(c.status??'')));
 });}
 const request=randomUUID();
 await db.query("insert into public.cms_change_requests(id,scan_id,site_id,workspace_id,actor_id,connection_id,changes,total) values($1,$2,$3,$4,$5,$6,'[]',2)",[request,scan,t.site,t.workspace,t.actor,t.connection]);
 for(const results of [[],[{status:'applied'}],[{status:'failed'},{status:'conflict'},{status:'uncertain'}]]){
 await db.query('update public.cms_change_requests set results=$2 where id=$1',[request,JSON.stringify(results)]);
 await asActor(db,t.actor,async()=>{const row=(await db.query<{status:string;expires_at:Date}>('select status,expires_at from public.cms_change_requests where id=$1',[request])).rows[0]!;
 const actual=(await db.query<{status:string;verified:number;attention:boolean}>('select * from public.site_change_summaries where id=$1',[request])).rows[0]!;
 expect({status:actual.status,verified:actual.verified,attention:actual.attention}).toEqual(cmsOperationSummary({...row,expires_at:row.expires_at.toISOString(),results}));});}
 await db.query(`insert into public.cms_change_requests(id,scan_id,site_id,workspace_id,actor_id,connection_id,changes,total,created_at)
 select gen_random_uuid(),$1,$2,$3,$4,$5,'[]',1,now()-interval '1 hour' from generate_series(1,12)`,[scan,t.site,t.workspace,t.actor,t.connection]);
 await asActor(db,t.actor,async()=>{
 const page=async(cursor:unknown=null,prev=false)=>{const r=await db.query('select * from public.site_activity_page($1,\'all\',0,$2,$3)',[t.site,JSON.stringify(cursor),prev]);return activityRowSchema.array().parse(JSON.parse(JSON.stringify(r.rows)));};
 // SQL NULL, not JSON null.
 const first=activityRowSchema.array().parse(JSON.parse(JSON.stringify((await db.query('select * from public.site_activity_page($1)',[t.site])).rows)));
 const next=await page(decodeActivityCursor(encodeActivityCursor(first[4]!)));
 expect(next.some(r=>first.slice(0,5).some(f=>f.id===r.id))).toBe(false);
 const back=await page(decodeActivityCursor(encodeActivityCursor(next[0]!)),true);
 expect(back.slice(0,5).reverse().map(r=>r.id)).toEqual(first.slice(0,5).map(r=>r.id));
 const overview=(await db.query<{summary:{recent:unknown[];activity:unknown[]}}>('select public.site_overview_summary($1) summary',[t.site])).rows[0]!.summary;
 expect(overview.recent).toHaveLength(5);expect(overview.activity).toHaveLength(5);
 const explain=await db.query('explain (analyze,buffers) select * from public.site_activity_page($1)',[t.site]);
 writeFileSync('/tmp/phase-b-activity-projection.json',JSON.stringify({rows:first.length,bytes:Buffer.byteLength(JSON.stringify(first)),plan:explain.rows},null,2));
 });
 await asActor(db,foreign.actor,async()=>expect((await db.query('select * from public.site_change_summaries where site_id=$1',[t.site])).rows).toHaveLength(0));
 await expect(asActor(db,foreign.actor,()=>db.query('select * from public.site_activity_page($1)',[t.site]))).rejects.toThrow('forbidden');
 await db.exec('set role anon');await expect(db.query('select * from public.site_change_summaries')).rejects.toThrow();await db.exec('reset role');
 }finally{await db.close();}
},30000);
