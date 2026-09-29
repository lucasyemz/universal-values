export function scanStartError(error:{code?:string;message?:string}|null|undefined) {
 if(error?.message === "Wait for scan changes to finish")return "changes-active";
 return error?.code==='23505' && /\bone_active_cms_scan\b/.test(error.message??'') ? 'active' : 'start';
}
