import { z } from "zod";
export const activityRowSchema = z.object({ id:z.uuid(), site_id:z.uuid(), source:z.enum(["cms","static"]),title:z.string(),target:z.string(),status:z.string(),label:z.string().nullable(),verified:z.number().int().nonnegative(),total:z.number().int().nonnegative(),created_at:z.string(),attention:z.boolean() });
const cursorSchema=z.object({at:z.iso.datetime({offset:true}),id:z.uuid(),source:z.enum(["cms","static"])});
export function decodeActivityCursor(value?:string) {
 if(!value || value.length>400)return null;
 try{return cursorSchema.parse(JSON.parse(Buffer.from(value,"base64url").toString("utf8")));}catch{return null;}
}
export function encodeActivityCursor(row:z.infer<typeof activityRowSchema>) {
 return Buffer.from(JSON.stringify({at:row.created_at,id:row.id,source:row.source})).toString("base64url");
}
