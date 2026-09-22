import {useText} from "../../../i18n/use-text";
import type {LinkDestinationGroup,LinkDraft} from "../../../modules/static-text/repeated-links";
import {componentLabel} from "../../../modules/static-text/component-label";

export function LinkGroup({group,busy,draft,onEdit}:{group:LinkDestinationGroup;busy:boolean;draft:LinkDraft;onEdit:(draft:LinkDraft)=>void}){
 const t=useText();
 const {url}=draft;
 const selected=new Set(draft.selected);
 return <article><h3 className="link-destination">{t(group.destination)}</h3><span className="badge">{group.occurrences.length === 1 ? t("1 ocorrência") : t("{0} ocorrências",group.occurrences.length)}</span>
  <ul className="link-occurrences">{group.occurrences.map(item=><li key={item.id}>
   <label className="check"><input type="checkbox" disabled={busy||!item.targetId} checked={!!item.targetId&&selected.has(item.targetId)} onChange={event=>{const next=new Set(selected);if(item.targetId){if(event.target.checked)next.add(item.targetId);else next.delete(item.targetId);}onEdit({...draft,selected:[...next]});}} />
    <span><strong>{item.text||item.label}</strong><small>{item.label} · {item.location}</small></span>
   </label>
   {item.source&&<small>{componentLabel(item.source,t)}</small>}
   {!item.targetId&&<small>{t("Este tipo de destino deve ser editado no Designer.")}</small>}
  </li>)}</ul>
  {group.occurrences.some(o=>o.targetId)&&<>
   <p className="muted">{t("Botões que usam o mesmo campo de link são selecionados juntos.")}</p>
   <label>{t("Novo destino")}<input value={url} disabled={busy||!draft.selected.length} maxLength={2000} placeholder="https://example.com/page" onChange={event=>{onEdit({...draft,url:event.target.value});}} /></label>
  </>}
 </article>;
}
