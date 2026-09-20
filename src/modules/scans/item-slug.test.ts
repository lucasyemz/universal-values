import { describe, expect, it, vi } from "vitest";
import { suggestItemSlug, withSlugUpdates } from "./item-slug";
import { buildFieldChanges, type FieldChange } from "./change-plan";
import { changeRequestSchema } from "./change-request-plan";
import { executeChangeField } from "./execute-change-field";
import { occurrenceSchema } from "./schema";
const id="11111111-1111-4111-8111-111111111111", collection="a".repeat(24), item="b".repeat(24), site="c".repeat(24);
const occurrence=occurrenceSchema.parse({id,scan_id:id,site_id:id,source_key:"name",collection_id:collection,collection_name:"CMS",item_id:item,item_name:"Nome antigo",locale:"",field_slug:"name",field_name:"Nome",field_type:"PlainText",source_value:"Nome antigo",raw_match:"Nome antigo",start_pos:0,end_pos:11,canonical:{type:"text",text:"Nome antigo"}});
const request=changeRequestSchema.parse({id,scan_id:id,site_id:id,workspace_id:id,actor_id:id,connection_id:id,changes:[{occurrenceId:id,after:{type:"text",text:"Novo nome"}}],status:"confirmed",cursor:0,total:1,dispatched:false,lease_until:null,retry_at:null,expires_at:"2099-01-01",results:[]});
const field:FieldChange={sourceKey:"name",occurrence,before:"Nome antigo",after:"Novo nome",occurrenceIds:[id],slug:{before:"nome-antigo",after:"novo-nome"}};
function setup(name="Nome antigo",slug="nome-antigo") {
  const current={id:item,isDraft:false,isArchived:false,fieldData:{name,slug}};
  const reader={sites:vi.fn(async()=>[{id:site,displayName:"Site",shortName:"site"}]),collections:vi.fn(async()=>[{id:collection,displayName:"CMS",slug:"cms"}]),collection:vi.fn(async()=>({id:collection,displayName:"CMS",slug:"cms",fields:[{id:"f",slug:"name",displayName:"Name",type:"PlainText"}]})),item:vi.fn(async()=>current)};
  const writer={updateField:vi.fn(async()=>{current.fieldData={name:"Novo nome",slug:"novo-nome"};return current;})};
  const deps={getSite:async()=>({connection_id:id,webflow_site_id:site}),getConnection:async()=>({connection:{workspace_id:id},reader,writer}),dispatch:vi.fn(async()=>true)};
  return {deps,reader,writer,current,run:(dispatched=false)=>executeChangeField({request,field,dispatched},deps)};
}
describe('CMS item name and slug',()=>{
  it.each([["  São Paulo  & Ação! ","sao-paulo-acao"],["Novo---Nome", "novo-nome"],["Produto 2026", "produto-2026"],["!!!", ""]])('normalizes %s', (name,slug)=>expect(suggestItemSlug(name)).toBe(slug));
  it('suggests from the full field after partial replacements',()=>{
    const o={...occurrence,source_value:"Plano antigo Premium",raw_match:"antigo",start_pos:6,end_pos:12,canonical:{type:"text" as const,text:"antigo"}};
    const plan=buildFieldChanges([o],[{occurrenceId:id,after:{type:"text",text:"São Paulo"}}]);
    expect(suggestItemSlug(String(plan[0]!.after))).toBe('plano-sao-paulo-premium');
    expect(()=>withSlugUpdates(plan,{other:{before:'old',after:'new'}})).toThrow();
  });
  it('writes the reviewed pair together and verifies both by rereading',async()=>{
    const f=setup();expect((await f.run()).result).toMatchObject({status:'applied',actual:'Novo nome',slugActual:'novo-nome'});
    expect(f.writer.updateField).toHaveBeenCalledWith(expect.objectContaining({field:'name',value:'Novo nome',slug:'novo-nome'}));
    expect(f.reader.item).toHaveBeenCalledTimes(2);
  });
  it('blocks a slug edit even when the name is unchanged',async()=>{
    const f=setup('Nome antigo','externally-edited');expect((await f.run()).result.status).toBe('conflict');expect(f.deps.dispatch).not.toHaveBeenCalled();
  });
  it('does not confuse a name-only update with an applied pair',async()=>{
    const f=setup('Novo nome','nome-antigo');expect((await f.run(true)).result.status).toBe('uncertain');expect(f.writer.updateField).not.toHaveBeenCalled();
    const done=setup('Novo nome','novo-nome');expect((await done.run(true)).result.status).toBe('already_applied');expect(done.writer.updateField).not.toHaveBeenCalled();
  });
  it('records uncertainty when the provider returns a different slug',async()=>{
    const f=setup();f.writer.updateField.mockImplementation(async()=>({...f.current,fieldData:{name:'Novo nome',slug:'novo-nome-2'}}));
    expect((await f.run()).result.status).toBe('uncertain');expect(f.writer.updateField).toHaveBeenCalledTimes(1);
  });
});
