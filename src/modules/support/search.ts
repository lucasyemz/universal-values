import type { HelpArticle } from './knowledge';
export const normalizeHelp = (text: string) => text.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const stop = new Set('como how do i eu um uma o a os as de da do no na para por com que meu minha to the in on and e texto text'.split(' '));
/** Literal token matching only: no requests, regex input or customer content inference. */
export function searchHelp(query:string, entries:HelpArticle[]) {
 const tokens=[...new Set(normalizeHelp(query.slice(0,300)).split(' ').filter(t=>t.length>1&&!stop.has(t)))];
 if(!tokens.length)return [];
 return entries.map(article=>({article,score:tokens.reduce((n,t)=>n+(article.terms.some(term=>normalizeHelp(term)===t)?3:normalizeHelp(article.title).split(' ').includes(t)?1:0),0)})).filter(v=>v.score>=3).sort((a,b)=>b.score-a.score||a.article.id.localeCompare(b.article.id)).slice(0,3).map(v=>v.article);
}
