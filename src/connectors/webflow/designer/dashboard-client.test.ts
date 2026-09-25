import {beforeAll,afterEach,expect,it,vi} from 'vitest';
let Client: typeof import('./dashboard-client').DesignerDashboardClient;
beforeAll(async()=>{vi.stubGlobal('DESIGNER_DASHBOARD_URL','https://dashboard.example');Client=(await import('./dashboard-client')).DesignerDashboardClient;});
afterEach(()=>{vi.restoreAllMocks();});
function storage(){const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};}
const id='11111111-1111-4111-8111-111111111111';
const home=(site:string)=>({siteId:id,siteName:'Test',workspaceId:id,webflowSiteId:site,expiresAt:new Date(Date.now()+30*86400000).toISOString(),recent:[]});
it('reopens each site without reconnecting and retains the token after a network failure',async()=>{
 vi.stubGlobal('localStorage',storage());
 const fetcher=vi.fn(async (_url:unknown,init?:RequestInit)=>new Response(JSON.stringify({data:home(JSON.parse(String(init?.body)).webflowSiteId)}),{status:200}));vi.stubGlobal('fetch',fetcher);
 const first=new Client();await first.connect('uvd_'+'a'.repeat(64),'a');await first.connect('uvd_'+'b'.repeat(64),'b');
 const reopened=new Client();expect(reopened.hasSession('a')).toBe(true);
 fetcher.mockRejectedValueOnce(new Error('offline'));
 await expect(reopened.home('a')).rejects.toThrow('Dashboard indisponível');
 expect(new Client().hasSession('a')).toBe(true);
 await expect(reopened.home('a')).resolves.toMatchObject({webflowSiteId:'a'});
 expect(new Client().hasSession('b')).toBe(true);
 reopened.disconnect();expect(new Client().hasSession('a')).toBe(false);expect(new Client().hasSession('b')).toBe(true);
});
it('does not treat server rejection as permission to renew or use another site token',async()=>{
 vi.stubGlobal('localStorage',storage());
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({data:home('a')}))));
 const client=new Client();await client.connect('uvd_'+'a'.repeat(64),'a');
 const denied=vi.fn(async()=>new Response(JSON.stringify({error:'expired'}),{status:401}));vi.stubGlobal('fetch',denied);
 await expect(new Client().home('a')).rejects.toThrow('expired');
 const missing=new Client();expect(missing.hasSession('b')).toBe(false);
 await expect(missing.home('b')).rejects.toThrow('Conecte');expect(denied).toHaveBeenCalledTimes(1);
});
