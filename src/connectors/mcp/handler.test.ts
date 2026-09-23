import { it, expect, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createMcpHandler } from './handler';
import { AgentError, toolNames } from '@/modules/agents/contracts';
const token='cr_mcp_'+'a'.repeat(64),origin='https://copyreplace.test';
function fixture() {
 const read=vi.fn(async(action:string)=>action==='authenticate'?{scope:'copyreplace:read'}:{rows:[{account:'alice',site:'test-site',name:'Synthetic'}]});
 const log=vi.fn();const handle=createMcpHandler(()=>({read,context:()=>({})}),()=>origin,log);
 const request=(body:unknown,extra:Record<string,string>={})=>new Request(origin+'/api/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:'Bearer '+token,...extra},body:JSON.stringify(body)});
 return {read,log,handle,request};
}
it('official SDK client initializes, discovers seven read-only tools and reads through shared service',async()=>{
 const f=fixture();
 const transport=new StreamableHTTPClientTransport(new URL(origin+'/api/mcp'),{requestInit:{headers:{Authorization:'Bearer '+token}},fetch:async(input,init)=>f.handle(new Request(input,init))});
 const client=new Client({name:'synthetic-test',version:'1'});
 await client.connect(transport);
 const tools=await client.listTools();expect(tools.tools.map(t=>t.name).sort()).toEqual([...toolNames].sort());
 expect(tools.tools.every(t=>t.annotations?.readOnlyHint===true && t.annotations?.destructiveHint===false)).toBe(true);
 expect(f.read.mock.calls.every(c=>c[0]==='authenticate')).toBe(true);
 const result=await client.callTool({name:'list_sites',arguments:{}});
 expect(result.isError).not.toBe(true);expect(result.structuredContent).toMatchObject({sites:[{account:'alice',site:'test-site'}],externalRequests:{W:0,I:0,E:0,G:0}});
 const denied=await client.callTool({name:'apply_replacement',arguments:{}});expect(denied.isError).toBe(true);
 expect(f.read.mock.calls.filter(c=>c[0]!=='authenticate')).toEqual([['list_sites',{}]]);
 expect(JSON.stringify(f.log.mock.calls)).not.toContain(token);
 await client.close();
});
it('rejects cookie-only, hostile origin/host, batch, unknown method and excessive input',async()=>{
 const f=fixture(),body={jsonrpc:'2.0',id:1,method:'tools/list'};
 expect((await f.handle(f.request(body,{Authorization:''}))).status).toBe(401);
 expect((await f.handle(f.request(body,{Origin:'https://attacker.test'}))).status).toBe(403);
 expect((await f.handle(f.request(body,{Host:'attacker.test'}))).status).toBe(403);
 expect(f.read).not.toHaveBeenCalled();
 expect((await f.handle(f.request([body]))).status).toBe(400);
 expect((await f.handle(f.request({...body,method:'resources/list'}))).status).toBe(400);
 expect((await f.handle(f.request({...body,padding:'x'.repeat(17000)}))).status).toBe(400);
 expect((await f.handle(new Request(origin+'/api/mcp'))).status).toBe(405);
});
it('expired/revoked auth and rate limits fail closed with no data or raw errors',async()=>{
 const f=fixture();f.read.mockRejectedValueOnce(new AgentError('AUTH_REQUIRED'));
 const request=f.request({jsonrpc:'2.0',id:1,method:'tools/list'});
 expect((await f.handle(request.clone())).status).toBe(401);
 f.read.mockRejectedValueOnce(new AgentError('RATE_LIMITED',30));
 const rate=await f.handle(request.clone());expect(rate.status).toBe(429);expect(rate.headers.get('Retry-After')).toBe('30');
 f.read.mockRejectedValueOnce(new Error('SECRET CONTENT'));
 expect(await (await f.handle(request)).text()).not.toContain('SECRET CONTENT');expect(JSON.stringify(f.log.mock.calls)).not.toContain('SECRET CONTENT');
});
it('valid response is private/no-store and malformed input never reaches domain reads',async()=>{
 const f=fixture();
 const result=await f.handle(f.request({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_scan_results',arguments:{account:'../bad',site:'site',scan:'uuid'}}}));
 expect(result.headers.get('Cache-Control')).toContain('no-store');expect(f.read.mock.calls).toEqual([['authenticate',{}]]);
});
