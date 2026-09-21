import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { isPlaceholder } from "@/modules/text-search/placeholders";

export function detectPlaceholders(source: string, richText: boolean) {
  const matches: {start:number;end:number;raw:string;canonical:{type:"text";text:string}}[]=[];
  const add=(from:number,to:number)=>{
    const chunk=source.slice(from,to),raw=chunk.trim();
    if(!raw || !isPlaceholder(raw))return;
    const start=from+chunk.indexOf(raw),end=start+raw.length;
    matches.push({start:[...source.slice(0,start)].length,end:[...source.slice(0,end)].length,raw,canonical:{type:"text",text:raw}});
  };
  if(!richText)add(0,source.length);
  else {
    const visit=(node:DefaultTreeAdapterMap["node"])=>{
      if("tagName" in node && ["script","style","template","textarea","title"].includes(node.tagName))return;
      if(node.nodeName==="#text" && node.sourceCodeLocation)add(node.sourceCodeLocation.startOffset,node.sourceCodeLocation.endOffset);
      if("childNodes" in node)node.childNodes.forEach(visit);
    };
    visit(parseFragment(source,{sourceCodeLocationInfo:true}));
  }
  return matches;
}
