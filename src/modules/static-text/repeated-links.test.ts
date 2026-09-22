import {expect,it} from "vitest";
import {groupLinks,filterLinkGroups,linkGroupCounts,groupRepeatedLinks,parseLinkDestination,type LinkOccurrence} from "./repeated-links";
const link=(id:string,url:string):LinkOccurrence=>({id,label:"Button",location:"Home",destination:{mode:"url",to:url}});
it("groups destinations independently of labels and excludes unique links",()=>{
 const groups=groupRepeatedLinks([link("1","/contact"),{...link("2","/contact"),label:"Contact us"},link("3","/about")]);
 expect(groups).toHaveLength(1);expect(groups[0]?.occurrences).toHaveLength(2);
});
it("does not fold path case, queries, fragments or protocols",()=>{
 expect(groupRepeatedLinks(["/Contact","/contact","/contact?x=1","/contact#team","https://example.com/contact","http://example.com/contact"].map((url,i)=>link(String(i),url)))).toHaveLength(0);
 expect(groupRepeatedLinks([link("1","https://EXAMPLE.com/contact"),link("2","https://example.com/contact")])).toHaveLength(1);
});
it("resolves native Webflow page destinations to their publish path",()=>{
 const internal:LinkOccurrence={...link("1",""),destination:{mode:"page",to:{pageId:"page"}}};
 const groups=groupRepeatedLinks([internal,link("2","/contact")],new Map([["page",{name:"Contact",path:"/contact"}]]));
 expect(groups[0]?.occurrences).toHaveLength(2);expect(groups[0]?.destination).toBe("Contact · /contact");
});
it("does not count the same occurrence twice or include executable and placeholder URLs",()=>{
 for(const url of ["#","","javascript:alert(1)","data:text/html,test","https://user:pass@example.com"]){expect(groupRepeatedLinks([link("1",url),link("2",url)])).toHaveLength(0);}
 expect(groupRepeatedLinks([link("1","/contact"),link("1","/contact")])).toHaveLength(0);
});
it("validates typed destinations and excludes unresolved CMS references",()=>{
 expect(parseLinkDestination({sourceType:"cms",fieldId:"x"})).toBeNull();
 expect(parseLinkDestination({mode:"page",to:"id"})).toBeNull();
 expect(parseLinkDestination({mode:"page",to:{pageId:"id"},openInNewTab:true})).toEqual({mode:"page",to:{pageId:"id"}});
});

it("includes unique destinations and partitions destination counts without double-counting an element",()=>{
 const groups=groupLinks([link("1","/contact"),link("2","/contact"),link("3","/about"),link("3","/about")]);
 expect(linkGroupCounts(groups)).toEqual({all:2,repeated:1,unique:1});
 expect(filterLinkGroups(groups,"all")).toHaveLength(2);
 expect(filterLinkGroups(groups,"unique")[0]?.destination).toBe("/about");
 expect(filterLinkGroups(groups,"repeated")[0]?.occurrences).toHaveLength(2);
 expect(linkGroupCounts([])).toEqual({all:0,repeated:0,unique:0});
});
