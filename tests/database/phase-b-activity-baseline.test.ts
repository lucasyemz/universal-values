import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {queryDatabase,tenant,savedScan,asActor} from './phase-b-fixture';
it('records the mixed-activity baseline and existing indexes before projection',async()=>{
 const db=await queryDatabase();try{
 const t=await tenant(db),scan=await savedScan(db,t,2),session=randomUUID();
 await db.query("insert into app_private.admins(user_id,reason) values($1,'Fixture')",[t.actor]);
 await db.query("insert into public.designer_sessions(id,site_id,actor_id,token_hash) values($1,$2,$3,$4)",[session,t.site,t.actor,'a'.repeat(64)]);
 await db.query(`insert into public.cms_change_requests(id,scan_id,site_id,workspace_id,actor_id,connection_id,changes,total,created_at)
 select gen_random_uuid(),$1,$2,$3,$4,$5,'[]',1,now()-n*interval '1 minute' from generate_series(1,300) n`,[scan,t.site,t.workspace,t.actor,t.connection]);
 await db.query(`insert into public.designer_changes(id,site_id,actor_id,session_id,search_text,plan,events,created_at)
 select gen_random_uuid(),$1,$2,$3,'example',jsonb_build_object('id',n::text,'context',jsonb_build_object('pageName','Home'),'changes',jsonb_build_array(jsonb_build_object('id','x','before',repeat(md5(n::text),50),'after','new'))),'[]',now()-n*interval '1 minute' from generate_series(1,300) n`,[t.site,t.actor,session]);
 await db.exec('analyze');
 const report=await asActor(db,t.actor,async()=>{
 const cms=await db.query('select id,status,cursor,total,created_at,expires_at,results,scan_id,managed_value_id,reverts_request_id from public.cms_change_requests where site_id=$1 order by created_at desc,id limit 101',[t.site]);
 const stat=await db.query('select id,plan,events,search_text,created_at,expires_at from public.designer_changes where site_id=$1 order by created_at desc,id limit 101',[t.site]);
 const plan=await db.query('explain (analyze,buffers) select id,status,cursor,total,created_at,expires_at,results,scan_id,managed_value_id,reverts_request_id from public.cms_change_requests where site_id=$1 order by created_at desc,id limit 101',[t.site]);
 expect(cms.rows.length+stat.rows.length).toBe(202);
 const after=await db.query("select * from public.site_activity_page($1,'all',95)",[t.site]);
 expect(after.rows).toHaveLength(6);
 const afterPlan=await db.query("explain (analyze,buffers) select * from public.site_activity_page($1,'all',95)",[t.site]);
 writeFileSync('/tmp/phase-b-activity-comparison.json',JSON.stringify({beforeRows:202,beforeBytes:Buffer.byteLength(JSON.stringify([...cms.rows,...stat.rows])),afterRows:6,afterBytes:Buffer.byteLength(JSON.stringify(after.rows)),beforePlan:plan.rows,afterPlan:afterPlan.rows},null,2));
 return {fixture:'300 CMS + 300 static events; page20/page-size5, 1600-character static source; no events bodies (conservative)',rows:202,bytes:Buffer.byteLength(JSON.stringify([...cms.rows,...stat.rows])),plan:plan.rows};
 });writeFileSync('/tmp/phase-b-activity-baseline.json',JSON.stringify(report,null,2));
 }finally{await db.close();}
},30000);
