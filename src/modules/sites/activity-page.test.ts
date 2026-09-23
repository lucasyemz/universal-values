import {expect,it} from 'vitest';
import {decodeActivityCursor,encodeActivityCursor,activityRowSchema} from './activity-page';
it('round trips stable activity identity and rejects malformed pagination input',()=>{
 const row=activityRowSchema.parse({id:'11111111-1111-4111-8111-111111111111',site_id:'22222222-2222-4222-8222-222222222222',source:'static',title:'Title',target:'Home',status:'draft',label:null,verified:0,total:1,created_at:'2026-09-23T12:00:00+00:00',attention:false});
 expect(decodeActivityCursor(encodeActivityCursor(row))).toEqual({at:row.created_at,id:row.id,source:'static'});
 for(const cursor of [undefined,'invalid','x'.repeat(401),Buffer.from(JSON.stringify({at:'bad',id:row.id,source:'static'})).toString('base64url')])expect(decodeActivityCursor(cursor)).toBeNull();
});
