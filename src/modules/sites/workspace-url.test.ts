import { expect, it } from "vitest";
import { workspacePath, workspaceRoute, workspaceDestination } from "./workspace-url";
it("uses the workspace name for both primary and secondary workspaces",()=>{
 expect(workspacePath('lucasmatrixx',{slug:'kazama-test',is_primary:true})).toBe('/dashboard/kazama-test/sites');
 expect(workspacePath('lucasmatrixx',{slug:'outros-sites',is_primary:false})).toBe('/dashboard/outros-sites/sites');
 expect(workspaceRoute('/dashboard/outros-sites/sites')).toEqual({id:null,account:null,slug:'outros-sites',suffix:'sites'});
});
it("recognizes old account and UUID forms without consuming site/resource paths",()=>{
 expect(workspaceRoute('/dashboard/lucasmatrixx/workspaces/cliente-2/sites')).toEqual({id:null,account:'lucasmatrixx',slug:'cliente-2',suffix:'sites'});
 expect(workspaceRoute('/dashboard/workspaces/b1e62961-a11a-413a-811d-b8011b997bf6/sites')?.id).toBe('b1e62961-a11a-413a-811d-b8011b997bf6');
 expect(workspaceRoute('/dashboard/workspaces/preview/123')).toBeNull();
 expect(workspaceRoute('/dashboard/lucasmatrixx/sites/projeto')).toBeNull();
 expect(workspaceRoute('/dashboard/lucasmatrixx/sites/projeto/scans/1')).toBeNull();
});
it("uses the same folder for workspace settings",()=>{
 expect(workspaceRoute('/dashboard/kazama-test/settings/webflow')?.suffix).toBe('settings/webflow');
 expect(workspaceRoute('/dashboard/lucasmatrixx/workspaces/cliente-2/settings/webflow')?.account).toBe('lucasmatrixx');
});
it("redirects legacy reads but rewrites actions without changing their method",()=>{
 const entry={workspace_id:'internal-id',slug:'kazama-test',is_primary:true};
 expect(workspaceDestination('/dashboard/lucasmatrixx/sites','GET',entry,'sites')).toEqual({kind:'redirect',pathname:'/dashboard/kazama-test/sites'});
 expect(workspaceDestination('/dashboard/lucasmatrixx/sites','POST',entry,'sites')).toEqual({kind:'rewrite',pathname:'/dashboard/workspaces/internal-id/sites'});
 expect(workspaceDestination('/dashboard/kazama-test/sites','GET',entry,'sites')).toEqual({kind:'rewrite',pathname:'/dashboard/workspaces/internal-id/sites'});
});
