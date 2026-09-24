export const scanResultTabs = ["pending", "reviewed", "variables"] as const;
export const scanResultTabLabels = { pending:"Pendentes", reviewed:"Revisados", variables:"Variáveis criadas" };
export function scanResultTab(input:string|undefined,counts:{pending:number;reviewed:number}) {
  if(input==="reviewed" || input==="variables")return input;
  // Existing saved-search links used 'all'. Keep their group/query usable when
  // every match has already been reviewed, without retaining an All screen.
  return input==="all" && counts.pending===0 && counts.reviewed>0 ? "reviewed" : "pending";
}
