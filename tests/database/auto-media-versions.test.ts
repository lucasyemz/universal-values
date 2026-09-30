import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {queryDatabase,tenant,asActor,savedScan} from './phase-b-fixture';
let db:Awaited<ReturnType<typeof queryDatabase>>;
beforeAll(async()=>{db=await queryDatabase();},30000);
afterAll(async()=>{await db.close();});
const plan=(types=['image'],id='a'.repeat(24))=>[{id,name:'CMS',types}];
async function start(t:Awaited<ReturnType<typeof tenant>>,p:unknown,id=randomUUID()){
 await asActor(db,t.actor,()=>db.query('select public.start_matching_cms_scan($1,$2,$3,false)',[id,t.site,JSON.stringify(p)]));return id;
}
it('groups fresh media reads even while queued, ignoring collection/type order and names',async()=>{
 const t=await tenant(db);const p=[...plan(['image','link']),...plan(['link'],'b'.repeat(24))];
 const first=await start(t,p),second=await start(t,[{...p[1],name:'Renamed'}, {...p[0],types:['link','image']}]);
 await start(t,[{...p[1],name:'Renamed'}, {...p[0],types:['link','image']}],second);
 const rows=(await db.query('select id,series_id,scan_version,is_latest,status,items_read from cms_scans where site_id=$1 order by scan_version',[t.site])).rows;
 expect(rows).toEqual([{id:first,series_id:first,scan_version:1,is_latest:false,status:'running',items_read:0},{id:second,series_id:first,scan_version:2,is_latest:true,status:'queued',items_read:0}]);
 expect((await db.query("select count(*)::int n from scan_audit_events where scan_id=$1 and action='scan.confirmed'",[second])).rows).toEqual([{n:1}]);
 await expect(start(t,plan(['link']),second)).rejects.toThrow('Operation key conflict');
});
it('keeps different scopes, media types and options separate; never groups text searches',async()=>{
 const t=await tenant(db);await db.query("insert into app_private.admins(user_id,reason) values($1,'Synthetic tests')",[t.actor]);
 const plans=[plan(),plan(['link']),plan(['image'],'b'.repeat(24)),[{...plan()[0],searchOptions:{ignoreCase:true}}],plan(['text']),plan(['text']),[{...plan(['text'])[0],searchText:'Name'}],[{...plan(['text'])[0],searchText:'Name'}],plan(['image','text']),plan(['image','text'])];
 for(const p of plans)await start(t,p);
 expect((await db.query('select count(*)::int n from cms_scans where site_id=$1 and is_latest and scan_version=1',[t.site])).rows).toEqual([{n:10}]);
});
it('only appends to the newest existing matching series and retains earlier independent evidence',async()=>{
 const t=await tenant(db),a=await savedScan(db,t,0,plan()),b=await savedScan(db,t,0,plan());
 await db.query("update cms_scans set created_at=created_at-interval '1 day' where id=$1",[a]);
 const next=await start(t,plan());
 expect((await db.query('select series_id,scan_version from cms_scans where id=$1',[next])).rows).toEqual([{series_id:b,scan_version:2}]);
 expect((await db.query('select is_latest from cms_scans where id=$1',[a])).rows).toEqual([{is_latest:true}]);
});
it('isolates sites/accounts and rolls back grouping when admission fails',async()=>{
 const t=await tenant(db),other=await tenant(db);const first=await start(t,plan()),foreign=await start(other,plan());
 expect((await db.query('select series_id from cms_scans where id=$1',[foreign])).rows).toEqual([{series_id:foreign}]);
 await expect(asActor(db,other.actor,()=>db.query('select public.start_matching_cms_scan($1,$2,$3,false)',[randomUUID(),t.site,JSON.stringify(plan())]))).rejects.toThrow('Site unavailable');
 await db.query("insert into app_private.quota_events(operation_id,kind,actor_id,amount) values(gen_random_uuid(),'scan',$1,5)",[t.actor]);
 await expect(start(t,plan())).rejects.toThrow();
 expect((await db.query('select is_latest,scan_version from cms_scans where id=$1',[first])).rows).toEqual([{is_latest:true,scan_version:1}]);
});
it('serializes manual repeats with automatic admission and does not restart numbering',async()=>{
 const t=await tenant(db),first=await start(t,plan());
 await db.query("update cms_scans set status='completed' where id=$1",[first]);
 const second=randomUUID();await asActor(db,t.actor,()=>db.query('select public.repeat_cms_scan($1,$2)',[second,first]));
 const third=await start(t,plan());
 expect((await db.query('select series_id,scan_version from cms_scans where id=$1',[third])).rows).toEqual([{series_id:first,scan_version:3}]);
});
it('normalizes omitted defaults but keeps an explicit search term out of grouping',async()=>{
 const t=await tenant(db),first=await start(t,plan(['link']));
 const second=await start(t,[{...plan(['link'])[0],searchText:'',placeholders:false,searchOptions:{ignoreCase:false,ignoreAccents:false,wholeWord:false}}]);
 expect((await db.query('select series_id,scan_version from cms_scans where id=$1',[second])).rows).toEqual([{series_id:first,scan_version:2}]);
 const specific=await start(t,[{...plan(['link'])[0],searchText:'example'}]);
 expect((await db.query('select series_id,scan_version from cms_scans where id=$1',[specific])).rows).toEqual([{series_id:specific,scan_version:1}]);
});
it('preserves confirmed operations and rejects automatic supersession until they finish',async()=>{
 const t=await tenant(db),scan=await savedScan(db,t,1,plan(['link'])),preview=randomUUID();
 const occurrence=(await db.query<{id:string}>('select id from scan_occurrences where scan_id=$1',[scan])).rows[0]!.id;
 await asActor(db,t.actor,()=>db.query('select public.preview_cms_changes($1,$2,$3)',[preview,scan,JSON.stringify([{occurrenceId:occurrence,after:{type:'text',text:'Changed'}}])]));
 await asActor(db,t.actor,()=>db.query('select public.confirm_cms_changes($1)',[preview]));
 await expect(start(t,plan(['link']))).rejects.toThrow('Wait for scan changes');
 expect((await db.query('select is_latest from cms_scans where id=$1',[scan])).rows).toEqual([{is_latest:true}]);
});
