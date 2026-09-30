import { z } from 'zod';
export const category = z.enum(['question','problem','suggestion']);
export const status = z.enum(['open','in_progress','resolved']);
export const newTicket = z.object({request:z.uuid(),category,subject:z.string().trim().min(3).max(160),body:z.string().trim().min(1).max(5000)});
export const replyTicket = z.object({request:z.uuid(),ticket:z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),body:z.string().trim().min(1).max(5000),status});
export const ticketRow = z.object({id:z.number(),owner_id:z.string(),category,subject:z.string(),status,created_at:z.string(),updated_at:z.string()});
export const messageRow = z.object({id:z.number(),is_staff:z.boolean(),body:z.string(),status,created_at:z.string()});
export const statusLabels = {open:'Aberto',in_progress:'Em atendimento',resolved:'Resolvido'};
export const categoryLabels = {question:'Dúvida',problem:'Problema',suggestion:'Sugestão de melhoria'};
