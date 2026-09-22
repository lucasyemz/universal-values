import {findMentions,type Mention,type TextNode,type TextPlan} from './plan';
import type {SearchOptions} from '../text-search/match';
import type {LinkDestinationGroup,LinkDraft} from './repeated-links';

// Rebase only original pending mentions; newly inserted matching text is not a new task.
export function continueTextScan(nodes:TextNode[],mentions:Mention[],drafts:Record<string,string>,plan:TextPlan,term:string,options:SearchOptions){
 const updates=new Map(plan.changes.map(change=>[change.id,change.after]));
 const nextNodes=nodes.map(node=>updates.has(node.id)?{...node,text:updates.get(node.id)!}:node);
 const changed=mentions.filter(m=>updates.has(m.nodeId)&&Object.hasOwn(drafts,m.key)&&drafts[m.key]!==m.text);
 const fresh=findMentions(nextNodes,term,options);
 const replacements:Record<string,string>={};
 const pending=mentions.flatMap(m=>{
  if(changed.includes(m))return [];
  const delta=changed.filter(c=>c.nodeId===m.nodeId&&c.start<m.start).reduce((sum,c)=>sum+drafts[c.key]!.length-c.text.length,0);
  const next=fresh.find(n=>n.nodeId===m.nodeId&&n.start===m.start+delta);
  if(!next)return [];
  if(Object.hasOwn(drafts,m.key))replacements[next.key]=drafts[m.key]!;
  return [next];
 });
 return {nodes:nextNodes,mentions:pending,replacements};
}
export function continueLinkScan(groups:LinkDestinationGroup[],drafts:Record<string,LinkDraft>,plan:TextPlan){
 const applied=new Set(plan.changes.map(change=>change.id));
 const nextGroups=groups.map(group=>({...group,occurrences:group.occurrences.filter(o=>!o.targetId||!applied.has(o.targetId))})).filter(group=>group.occurrences.length);
 const nextDrafts=Object.fromEntries(nextGroups.flatMap(group=>{const draft=drafts[group.key];return draft?[[group.key,{...draft,selected:draft.selected.filter(id=>!applied.has(id))}]]:[];}));
 return {groups:nextGroups,drafts:nextDrafts};
}

export type ReviewedOccurrence = TextPlan["changes"][number] & {
 reviewKey:string; pageName:string; location:string; contextBefore?:string; contextAfter?:string;
};
export function reviewedOccurrences(plan:TextPlan,mentions:Mention[],drafts:Record<string,string>,groups:LinkDestinationGroup[]):ReviewedOccurrence[]{
 return plan.changes.flatMap<ReviewedOccurrence>(change=>change.link
  ?groups.flatMap(group=>group.occurrences.filter(o=>o.targetId===change.id).map(o=>({...change,reviewKey:JSON.stringify([plan.id,o.id]),pageName:plan.context.pageName,location:`${o.text||o.label} · ${o.location}`,link:{...change.link!,buttons:[`${o.text||o.label} · ${o.location}`]}})))
  :mentions.filter(m=>m.nodeId===change.id&&Object.hasOwn(drafts,m.key)&&drafts[m.key]!==m.text).map(m=>({...change,reviewKey:JSON.stringify([plan.id,m.key]),pageName:plan.context.pageName,location:m.location??"",contextBefore:m.before,contextAfter:m.after,before:m.text,after:drafts[m.key]!})));
}

export function editSelectedMentions(drafts:Record<string,string>,activeKey:string,value:string){
 const keys=Object.hasOwn(drafts,activeKey)?Object.keys(drafts):[activeKey];
 return {...drafts,...Object.fromEntries(keys.map(key=>[key,value]))};
}

export function mergeReviewed(current:ReviewedOccurrence[],incoming:ReviewedOccurrence[]){
 return [...new Map([...current,...incoming].map(item=>[item.reviewKey,item])).values()];
}

// Checkbox state is the source of truth; browsing a card must never add it to a preview.
export function selectedTextEditor(mentions:Mention[],drafts:Record<string,string>,activeKey?:string){
 const selected=mentions.filter(mention=>Object.hasOwn(drafts,mention.key));
 const active=selected.find(mention=>mention.key===activeKey)??selected[0];
 const values=selected.map(mention=>drafts[mention.key]!);
 const mixed=values.some(value=>value!==values[0]);
 return {selected,active,mixed,value:mixed?"":values[0]??""};
}
export function toggleTextSelection(drafts:Record<string,string>,mention:Mention){
 const next={...drafts};
 if(Object.hasOwn(next,mention.key))delete next[mention.key];else next[mention.key]=mention.text;
 return next;
}
