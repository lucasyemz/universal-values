import { expect, it } from "vitest";
import { workspacePath, workspaceRoute } from "./workspace-url";
it("maps the account's primary workspace to its sites list",()=>{
 expect(workspaceRoute('/dashboard/lucasmatrixx/sites')).toEqual({id:null,account:'lucasmatrixx',slug:null});
 expect(workspacePath('lucasmatrixx',{slug:'principal',is_primary:true})).toBe('/dashboard/lucasmatrixx/sites');
});
it("preserves distinct workspaces without UUIDs in their URLs",()=>{
 expect(workspaceRoute('/dashboard/lucasmatrixx/workspaces/cliente-2/sites')).toEqual({id:null,account:'lucasmatrixx',slug:'cliente-2'});
 expect(workspacePath('lucasmatrixx',{slug:'cliente-2',is_primary:false})).toBe('/dashboard/lucasmatrixx/workspaces/cliente-2/sites');
 expect(workspaceRoute('/dashboard/workspaces/b1e62961-a11a-413a-811d-b8011b997bf6/sites')?.id).toBe('b1e62961-a11a-413a-811d-b8011b997bf6');
 expect(workspaceRoute('/dashboard/workspaces/preview/123')).toBeNull();
 expect(workspaceRoute('/dashboard/lucasmatrixx/sites/projeto')).toBeNull();
});
it("supports workspace settings without UUIDs",()=>{
 expect(workspaceRoute('/dashboard/lucasmatrixx/settings/webflow')).toEqual({id:null,account:'lucasmatrixx',slug:null,suffix:'settings/webflow'});
 expect(workspaceRoute('/dashboard/lucasmatrixx/workspaces/cliente-2/settings/webflow')?.suffix).toBe('settings/webflow');
 expect(workspaceRoute('/dashboard/workspaces/b1e62961-a11a-413a-811d-b8011b997bf6/settings/webflow')?.suffix).toBe('settings/webflow');
});
