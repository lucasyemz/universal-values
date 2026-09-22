import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {InlineReview} from '../../src/components/scans/inline-review';
import {Button,PageHeader,StatusBadge,ContextHelp} from '../../src/components/ui';
import {AiConnectionDialog} from '../../src/components/ai/connection-dialog';
import type {InlinePreview} from '../../src/modules/scans/inline-preview';
function Fixture(){
 const [value,setValue]=useState('New example content'),[mode,setMode]=useState('success'),[locked,setLocked]=useState(false),[dialog,setDialog]=useState(false),[revision,setRevision]=useState(0);
 const field={sourceKey:'source',collection:'Test collection',item:'Test item',field:'Description',locale:'',collectionId:'test',itemId:'test',images:[],before:'Original example content',after:value,slug:null};
 return <main className="ui-page max-w-5xl"><PageHeader title="Dashboard QA — isolated fixtures" description="Local test data only. No Supabase, Gemini or Webflow connection."/>
 <div className="mb-6 flex flex-wrap gap-3"><StatusBadge status="applied"/><StatusBadge status="conflict"/><StatusBadge status="reverted"/><Button disabled>Disabled action</Button><Button variant="secondary" onClick={()=>setDialog(true)}>Open test dialog</Button></div>
 {dialog&&<AiConnectionDialog onClose={()=>setDialog(false)} onConnected={()=>setDialog(false)}/>}
 <label className="block">Scenario<select value={mode} onChange={e=>{setMode(e.target.value);setLocked(false);setRevision(n=>n+1);}}><option value="success">Success</option><option value="conflict">Server rejects stale preview</option><option value="batch">Batch with slug</option></select></label>
 <label className="my-5 block">New value<textarea className="mt-2 w-full" disabled={locked} value={value} onChange={e=>setValue(e.target.value)}/></label>
 <InlineReview key={revision} draftKey={JSON.stringify({value,mode})} onConfirmingChange={setLocked} prepare={async id=>{
  await new Promise(r=>setTimeout(r,700));
  const fields=mode==='batch'?[field,{...field,sourceKey:'source2',itemId:'test2',item:'Second test item',slug:{before:'old-name',after:'new-name'}}]:[field];
  return {ok:true,preview:{id,scanId:null,digest:mode==='conflict'?'conflict':'success',expiresAt:new Date(Date.now()+60000).toISOString(),fields,central:null,fieldCount:mode==='batch'?3:1,itemCount:fields.length,slugCount:mode==='batch'?1:0,removalCount:0} satisfies InlinePreview};
 }}/>
 <ContextHelp className="mt-6" title="Fixture limitations">This page tests the real inline review component and dialog with mock server actions. It does not validate a live provider write.</ContextHelp>
 </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
