/// <reference types="@webflow/designer-extension-typings" />
export type LocationPart={label:string;section:boolean;body:boolean};
export async function elementLocation(element:AnyElement):Promise<LocationPart>{
 let label:string=element.type,tag='';
 try {if('getDisplayName' in element)label=await element.getDisplayName()||label;}catch{/* Optional label. */}
 try {if('getTag' in element)tag=(await element.getTag())??'';}catch{/* Some native elements do not expose a tag. */}
 try {
  if('getStyles' in element){
   const styles=await element.getStyles();
   const primary=(styles??[]).find(style=>style!==null);
   if(primary)label=(await primary.getName())||label;
  }
 }catch{/* Reading classes must not prevent scanning content. */}
 return {label,section:element.type==='Section'||tag==='section'||tag==='header'||tag==='footer',body:element.type==='Body'||tag==='body'};
}
function isGeneralWrapper(label:string){
 const normalized=label.replace(/([a-z0-9])([A-Z])/g,'$1-$2').toLowerCase().replace(/[\s_]+/g,'-');
 return /^(?:(?:page|site|main|global|outer|body|app)[-]?)?wrapper(?:-\d+)?$/.test(normalized);
}
export function shortLocation(parts:LocationPart[]){
 const usable=parts.filter(part=>!part.body);
 const element=usable.at(-1);
 if(!element)return '';
 const ancestors=usable.slice(0,-1);
 const parent=ancestors.find(part=>part.section)??ancestors.find(part=>!isGeneralWrapper(part.label));
 return (parent&&parent!==element?`${parent.label} → ${element.label}`:element.label).slice(0,2000);
}
