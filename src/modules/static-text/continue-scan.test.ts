import {expect,it} from 'vitest';
import {findMentions,preparePlan} from './plan';
import {exactSearch} from '../text-search/match';
import {selectedTextEditor,toggleTextSelection,continueTextScan,continueLinkScan,editSelectedMentions,reviewedOccurrences,mergeReviewed} from './continue-scan';
import {groupLinks,initialLinkDraft,prepareLinksPlan} from './repeated-links';
import {linkSnapshot} from './link-edit';
const context={siteId:'s',pageId:'p',pageName:'Home',rootId:'r'};
it('continues another mention in the same node after offsets shift, without repeating inserted matches',()=>{
 const nodes=[{id:'n',text:'Find and Find'}],mentions=findMentions(nodes,'Find');
 const drafts={[mentions[0]!.key]:'Find more'};
 const plan=preparePlan(context,nodes,'Find',drafts);
 const next=continueTextScan(nodes,mentions,drafts,plan,'Find',exactSearch);
 expect(next.mentions).toHaveLength(1);expect(next.mentions[0]?.start).toBe(14);
 expect(reviewedOccurrences(plan,mentions,drafts,[])).toHaveLength(1);
 const second=preparePlan(context,next.nodes,'Find',{[next.mentions[0]!.key]:'Done'});
 expect(second.changes[0]?.after).toBe('Find more and Done');
});
it('preserves untouched drafts and excludes unchanged values from reviewed',()=>{
 const nodes=[{id:'a',text:'Find'},{id:'b',text:'Find'}],mentions=findMentions(nodes,'Find');
 const drafts={[mentions[0]!.key]:'Done',[mentions[1]!.key]:'Find'};
 const plan=preparePlan(context,nodes,'Find',drafts);
 const next=continueTextScan(nodes,mentions,drafts,plan,'Find',exactSearch);
 expect(next.mentions.map(m=>m.nodeId)).toEqual(['b']);expect(next.replacements).toEqual({[mentions[1]!.key]:'Find'});
 expect(reviewedOccurrences(plan,mentions,drafts,[])).toHaveLength(1);
});

it('keeps the rest of a partially selected link group available for a new preview',()=>{
 const groups=groupLinks(['a','b'].map(id=>({id,label:id,location:'Home',destination:{mode:'url' as const,to:'/old'},targetId:id,snapshot:linkSnapshot({mode:'url',to:'/old'},id)})));
 const group=groups[0]!,drafts={[group.key]:{...initialLinkDraft(group),selected:['a'],url:'/new'}};
 const plan=prepareLinksPlan(context,groups,drafts),next=continueLinkScan(groups,drafts,plan);
 expect(next.groups[0]?.occurrences.map(o=>o.id)).toEqual(['b']);
 expect(next.drafts[group.key]?.selected).toEqual([]);
 expect(reviewedOccurrences(plan,[],{},groups)).toHaveLength(1);
 const second=prepareLinksPlan(context,next.groups,{[group.key]:{selected:['b'],url:'/another'}});
 expect(second.changes.map(c=>c.id)).toEqual(['b']);
});

it('retains original location and surrounding context in the immutable applied record',()=>{
 const nodes=[{id:'n',text:'Before Find after',location:'Hero → Heading'}];
 const mentions=findMentions(nodes,'Find'),drafts={[mentions[0]!.key]:'Done'};
 const plan=preparePlan(context,nodes,'Find',drafts);
 const records=reviewedOccurrences(plan,mentions,drafts,[]);
 expect(records[0]).toMatchObject({pageName:'Home',location:'Hero → Heading',before:'Find',after:'Done',contextBefore:'Before ',contextAfter:' after'});
 drafts[mentions[0]!.key]='Something else';
 expect(records[0]?.after).toBe('Done');
});

it('edits all selected mentions together and prepares the exact batch shown',()=>{
 const nodes=[{id:'a',text:'Find'},{id:'b',text:'Find'},{id:'c',text:'Find'}],mentions=findMentions(nodes,'Find');
 const selected=Object.fromEntries(mentions.slice(0,2).map(m=>[m.key,m.text]));
 const drafts=editSelectedMentions(selected,mentions[0]!.key,'Updated');
 expect(Object.values(drafts)).toEqual(['Updated','Updated']);
 expect(preparePlan(context,nodes,'Find',drafts).changes.map(c=>[c.id,c.after])).toEqual([['a','Updated'],['b','Updated']]);
 expect(editSelectedMentions(selected,mentions[2]!.key,'Single')).toEqual({...selected,[mentions[2]!.key]:'Single'});
});

it('does not duplicate the same applied records and keeps distinct mentions in one node',()=>{
 const nodes=[{id:'n',text:'Find and Find'}],mentions=findMentions(nodes,'Find');
 const drafts=Object.fromEntries(mentions.map(m=>[m.key,'Done']));
 const plan=preparePlan(context,nodes,'Find',drafts);
 const records=reviewedOccurrences(plan,mentions,drafts,[]);
 expect(records).toHaveLength(2);expect(records[0]?.reviewKey).not.toBe(records[1]?.reviewKey);
 expect(mergeReviewed(records,records)).toHaveLength(2);
 const partial=preparePlan(context,nodes,'Find',{[mentions[0]!.key]:'Done'});
 expect(reviewedOccurrences(partial,mentions,{[mentions[0]!.key]:'Done'},[])).toHaveLength(1);
});

it('shows only checked occurrences even when an unchecked card was active',()=>{
 const mentions=findMentions([{id:'a',text:'Product A'},{id:'b',text:'Product B'},{id:'c',text:'Product C'}],'Product');
 const drafts={[mentions[1]!.key]:'New',[mentions[2]!.key]:'New'};
 const editor=selectedTextEditor(mentions,drafts,mentions[0]!.key);
 expect(editor.selected.map(m=>m.nodeId)).toEqual(['b','c']);
 expect(editor.active?.nodeId).toBe('b');
 expect(editor.value).toBe('New');
 expect(Object.keys(editSelectedMentions(drafts,editor.active!.key,'Updated'))).toEqual(Object.keys(drafts));
 const single=selectedTextEditor(mentions,toggleTextSelection(drafts,mentions[1]!),mentions[1]!.key);
 expect(single.selected).toHaveLength(1);expect(single.active?.nodeId).toBe('c');
 expect(selectedTextEditor(mentions,{},mentions[0]!.key).active).toBeUndefined();
});
it('preserves different checked drafts until the user edits the group',()=>{
 const mentions=findMentions([{id:'a',text:'Product'},{id:'b',text:'Product'}],'Product');
 const drafts={[mentions[0]!.key]:'One',[mentions[1]!.key]:'Two'};
 expect(selectedTextEditor(mentions,drafts).mixed).toBe(true);
 expect(drafts[mentions[1]!.key]).toBe('Two');
});
