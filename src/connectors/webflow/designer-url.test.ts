import {expect,it} from "vitest";
import {webflowDesignerUrl} from "./designer-url";
it("builds a site-specific Designer link and encodes the optional extension ID",()=>{
 expect(webflowDesignerUrl('My-Site')).toBe('https://my-site.design.webflow.com/');
 expect(webflowDesignerUrl('my-site','app&id')).toBe('https://my-site.design.webflow.com/?app=app%26id');
});
it.each(['','https://example.com','x/y','x.example.com','-site','site-','a'.repeat(64)])('rejects malformed site short names',name=>expect(webflowDesignerUrl(name)).toBeNull());
