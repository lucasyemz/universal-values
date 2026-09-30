import { expect,it } from 'vitest';
import { articles } from './knowledge';
import { searchHelp } from './search';
import { newTicket } from './schema';
it('matches accented Portuguese and English synonyms',()=>{expect(searchHelp('páginas estáticas',articles)[0]?.id).toBe('static');expect(searchHelp('static page',articles)[0]?.id).toBe('static');expect(searchHelp('minha cota',articles)[0]?.id).toBe('limit');expect(searchHelp('variables',articles)[0]?.id).toBe('variable');});
it('does not invent an answer for unknown questions or execute regex input',()=>{expect(searchHelp('pizza delivery',articles)).toEqual([]);expect(searchHelp('.*',articles)).toEqual([]);expect(searchHelp('',articles)).toEqual([]);});
it('requires bounded useful ticket input',()=>{expect(newTicket.safeParse({request:crypto.randomUUID(),category:'problem',subject:'',body:'test'}).success).toBe(false);expect(newTicket.safeParse({request:crypto.randomUUID(),category:'problem',subject:'Error',body:'x'.repeat(5001)}).success).toBe(false);});
