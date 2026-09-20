import { beforeEach, expect, it, vi } from "vitest";
vi.mock('server-only',()=>({}));
vi.mock('@/modules/auth/service',()=>({requireUser:vi.fn()}));
vi.mock('@/modules/sites/service',()=>({getConnectionReader:vi.fn()}));
vi.mock('./change-service',()=>({loadChangeRequest:vi.fn()}));
import { requireUser } from '@/modules/auth/service';
import { getConnectionReader } from '@/modules/sites/service';
import { loadChangeRequest } from './change-service';
import { prepareItemSlugs } from './slug-service';
const id='11111111-1111-4111-8111-111111111111',item='a'.repeat(24),collection='b'.repeat(24);
function setup(revert=false) {
  const request={id,status:'preview',connection_id:id,reverts_request_id:revert?'original':null,slug_updates:null};
  const field={sourceKey:'name',before:'Velho',after:'São Paulo Premium',occurrence:{field_slug:'name',field_type:'PlainText',item_id:item,collection_id:collection,locale:''}};
  const rpc=vi.fn(async()=>({error:null}));
  vi.mocked(requireUser).mockResolvedValue({client:{rpc}} as unknown as Awaited<ReturnType<typeof requireUser>>);
  const read=vi.fn(async()=>({id:item,isArchived:false,fieldData:{name:'Velho',slug:'velho-personalizado'}}));
  vi.mocked(getConnectionReader).mockResolvedValue({reader:{item:read}} as unknown as Awaited<ReturnType<typeof getConnectionReader>>);
  vi.mocked(loadChangeRequest).mockResolvedValue({request,plan:[field]} as unknown as Awaited<ReturnType<typeof loadChangeRequest>>);
  return {request,field,rpc,read};
}
beforeEach(()=>vi.clearAllMocks());
it('stores the observed slug and normalized complete name without writing to Webflow',async()=>{
  const f=setup();await prepareItemSlugs(id);
  expect(f.read).toHaveBeenCalledWith(collection,item,'');
  expect(f.rpc).toHaveBeenCalledWith('prepare_cms_item_slugs',{p_id:id,p_updates:{name:{before:'velho-personalizado',after:'sao-paulo-premium'}}});
});
it('restores the original custom slug on revert instead of deriving it from the old name',async()=>{
  const f=setup(true);
  vi.mocked(loadChangeRequest).mockResolvedValueOnce({request:f.request,plan:[f.field]} as unknown as Awaited<ReturnType<typeof loadChangeRequest>>)
    .mockResolvedValueOnce({request:{slug_updates:{name:{before:'custom-url',after:'new-name'}},results:[{sourceKey:'name',status:'applied',slugActual:'new-name'}]}} as unknown as Awaited<ReturnType<typeof loadChangeRequest>>);
  await prepareItemSlugs(id);
  expect(f.read).not.toHaveBeenCalled();
  expect(f.rpc).toHaveBeenCalledWith('prepare_cms_item_slugs',{p_id:id,p_updates:{name:{before:'new-name',after:'custom-url'}}});
});
it('never regenerates a frozen slug preview on a retry',async()=>{
  const f=setup();vi.mocked(loadChangeRequest).mockResolvedValue({request:{...f.request,slug_updates:{name:{before:'old',after:'new'}}},plan:[f.field]} as unknown as Awaited<ReturnType<typeof loadChangeRequest>>);
  await prepareItemSlugs(id);expect(f.read).not.toHaveBeenCalled();expect(f.rpc).not.toHaveBeenCalled();
});
it('rejects empty names and names without usable slug characters',async()=>{
  for(const value of ['', '!!!']) {
    const f=setup();f.field.after=value;
    await expect(prepareItemSlugs(id)).rejects.toThrow();expect(f.rpc).not.toHaveBeenCalled();
  }
});
