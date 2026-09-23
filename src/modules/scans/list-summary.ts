import {z} from 'zod';
import {scanSchema} from './schema';
import {numericSearchValue} from './numeric-search';
export const scanListSchema=scanSchema.pick({id:true,status:true,plan:true,created_at:true});
export type ScanListRow=z.infer<typeof scanListSchema>;
export const reviewSummarySchema=z.object({scan_id:z.uuid(),pending:z.number().int().nonnegative(),reviewed:z.number().int().nonnegative(),total:z.number().int().nonnegative(),numeric_singletons:z.array(z.object({collection_id:z.string(),number:z.string(),reviewed:z.boolean()})).max(1000)});
export function scanReviewSummary(scan:ScanListRow,row:z.infer<typeof reviewSummarySchema>) {
 let pending=row.pending,reviewed=row.reviewed;
 for(const candidate of row.numeric_singletons)if(scan.plan.some(entry=>entry.id===candidate.collection_id && numericSearchValue(entry.searchText)===candidate.number)) {
  if(candidate.reviewed)reviewed++;else pending++;
 }
 return {pending,reviewed,all:pending+reviewed};
}
