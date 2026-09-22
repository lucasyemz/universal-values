"use client";
import { useState } from "react";
import { InlineReview } from "./inline-review";
import { readInlinePreview } from "@/modules/scans/inline-actions";
export function ExistingPreview({id,reverting}:{id:string;reverting:boolean}) {
 const [,setLocked]=useState(false);
 return <InlineReview reverting={reverting} draftKey={id} prepare={()=>readInlinePreview(id)} onConfirmingChange={setLocked}/>;
}
