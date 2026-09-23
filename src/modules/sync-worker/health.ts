import {z} from 'zod';
export const workerHealthSchema=z.object({state:z.enum(['idle','waiting','processing','stalled','cooldown','worker_error','attention','queued']),nextAt:z.string().nullable()});
export type WorkerState=z.infer<typeof workerHealthSchema>['state']|'checking'|'missing'|'unknown';
export function workerHealthMessage(state:WorkerState):string {
 const labels:Record<WorkerState,string>={
 idle:'Nenhuma alteração aguardando execução.',waiting:'Aguardando o horário previsto ou uma operação anterior.',processing:'O worker está processando alterações.',stalled:'Há trabalho disponível sem avanço recente. Confira o executor e o agendamento.',cooldown:'Aguardando o prazo indicado pelo provedor.',worker_error:'O worker encontrou um erro. Confira a operação antes de retomar.',attention:'A operação aguarda sua revisão.',queued:'Alteração pronta para o próximo processamento.',checking:'Verificando disponibilidade do executor…',missing:'Aplique a migration da Phase D para consultar o estado do worker.',unknown:'Não foi possível verificar a disponibilidade do worker.'};
 return labels[state];
}
