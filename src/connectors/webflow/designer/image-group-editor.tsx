import {useText} from "@/i18n/use-text";
import {DesignerImagePreview} from "@/components/designer-image-preview";
import type {ImageDraft,ImageGroup} from "../../../modules/static-text/image-plan";
import {imageUrlSchema} from "../../../modules/static-text/image-edit";
export function ImageGroupEditor({group,draft,busy,onEdit}:{group:ImageGroup;draft:ImageDraft;busy:boolean;onEdit:(draft:ImageDraft)=>void}){
 const t=useText(),editable=group.occurrences.filter(o=>o.targetId&&o.snapshot);
 const nextUrl=(draft.url??group.url).trim();
 return <article className="image-group-editor"><h3>{group.name}</h3>
 <a className="image-url" href={group.url} target="_blank" rel="noreferrer">{group.url}</a>
 <label className="check"><input type="checkbox" disabled={busy||!editable.length} checked={editable.length>0&&editable.every(o=>draft.selected.includes(o.id))} onChange={e=>onEdit({...draft,selected:e.target.checked?editable.map(o=>o.id):[]})}/>{t("Selecionar grupo")}</label>
 {group.occurrences.map(item=><label className="check" key={item.id}><input type="checkbox" disabled={busy||!item.targetId} checked={draft.selected.includes(item.id)} onChange={e=>onEdit({...draft,selected:e.target.checked?[...draft.selected,item.id]:draft.selected.filter(id=>id!==item.id)})}/><span>{item.component?item.component+" · ":""}{item.location}{!item.targetId&&<small>{t("Edite este vínculo no Designer.")}</small>}{item.source?.kind==="component-definition"&&<small>{t("Imagem compartilhada · {0} instâncias no site",item.source.instanceCount)}</small>}</span></label>)}
 <label>{t("URL da nova imagem")}<input type="url" placeholder="https://example.com/image.jpg" maxLength={2000} disabled={busy||!draft.selected.length} value={draft.url??group.url} onChange={e=>onEdit({...draft,url:e.target.value,asset:undefined})}/></label>
 <small>{t("Imagens nativas serão importadas no Webflow somente ao confirmar. Máximo de 4 MB.")}</small>
 {draft.selected.length>0&&<><p>{t("{0} ocorrências selecionadas",draft.selected.length)}</p><DesignerImagePreview before={group.url} after={imageUrlSchema.safeParse(nextUrl).success?nextUrl:""} emptyLabel={t("Cole uma URL de imagem válida para ver a prévia.")} beforeLabel={t("Antes")} afterLabel={t("Depois")}/></>}
 </article>;
}
