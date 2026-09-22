/* eslint-disable @next/next/no-img-element -- Standalone extension. */
import type {LinkFilter} from "../../../modules/static-text/repeated-links";
import {useText} from "@/i18n/use-text";
import type {scanImages} from "./image-scan";
export function ImageResults({scan,activeUrl,onSelect,busy,filter,setFilter}:{scan:Awaited<ReturnType<typeof scanImages>>;activeUrl?:string;onSelect:(url:string)=>void;busy:boolean;filter:LinkFilter;setFilter:(filter:LinkFilter)=>void}){
 const t=useText();
 const groups=scan.groups.filter(group=>filter==="all"||(filter==="repeated"?group.occurrences.length>1:group.occurrences.length===1));
 return <section><h2>{t("Imagens da página")} · {scan.context.pageName}</h2>
 <p>{t("{0} imagens · {1} arquivos",scan.groups.reduce((sum,g)=>sum+g.occurrences.length,0),scan.groups.length)}</p>
 <p className="muted">{t("Selecione um grupo para escolher as ocorrências e editar a imagem.")}</p>
 <div className="link-filters" role="group" aria-label={t("Filtrar imagens")}>
 {([{key:"repeated",label:"Repetidos"},{key:"unique",label:"Únicos"},{key:"all",label:"Todos"}] as const).map(item=><button type="button" key={item.key} aria-pressed={filter===item.key} disabled={busy} onClick={()=>setFilter(item.key)}>{t(item.label)} ({scan.groups.filter(group=>item.key==="all"||(item.key==="repeated"?group.occurrences.length>1:group.occurrences.length===1)).length})</button>)}
 </div>
 {!groups.length&&<p role="status">{t("Nenhuma imagem neste filtro.")}</p>}
 {groups.map(group=><button type="button" className="result-card image-result-card" key={group.url} aria-pressed={activeUrl===group.url} disabled={busy} onClick={()=>onSelect(group.url)}>
 <img src={group.url} alt="" loading="lazy" referrerPolicy="no-referrer"/>
 <span><strong>{group.name}</strong><span className="result-value">{group.url}</span><small>{group.occurrences.length} {t("Ocorrências")} · {group.occurrences[0]?.component||group.occurrences[0]?.location}</small></span>
 <span className="badge">{t("Imagens")}</span>
 </button>)}</section>;
}
