# Plano gratuito e administrador

A migration `20260920001600_free_plan_limits.sql` aplica cotas no PostgreSQL, inclusive para chamadas diretas às RPCs. A UI somente apresenta consumo e erros; não decide privilégios.

| Recurso | Free | Administrador |
| --- | --- | --- |
| Sites Webflow por conta, somando workspaces | 1 | Sem cota comercial |
| Scans confirmados/mês | 5 | Sem cota comercial |
| Itens processados/scan novo | 100 | 500 (limite técnico) |
| Campos CMS confirmados/mês | 50 | Sem cota comercial |
| Operações ativas (scan ou alteração CMS) | 1 | Sem cota comercial |
| Preparações de operações/mês | 200 | Sem cota comercial |
| Acessos à integração/mês | 1.000 | Sem cota comercial |
| Preparações + acessos à integração/minuto | 60 | Sem cota comercial |

Acesso à integração significa obtenção autorizada da credencial pelo executor, não cada requisição HTTP externa. Uma leitura pode envolver várias páginas/endpoints. Preparações incluem conexão, workspace, scan, alterações, Managed Values, Global Facts e sessões/alterações Designer. Essas proteções não limitam todas as requisições HTTP, autenticação ou leituras do banco.

O consumo mensal renova no primeiro dia às 00h UTC. A reserva acontece na confirmação, na mesma transação da operação; repetir a confirmação não consome novamente. Cancelamentos e falhas não devolvem cotas. Campos incluem sincronização de Managed Values, resolução de divergências e reversões CMS. Scans pausados continuam ocupando a operação ativa. Dados e histórico anteriores são preservados; scans já iniciados conservam seu limite original. Consumo novo começa na ativação da migration.

## Proteção global

Valores iniciais conservadores em `app_private.plan_policy`: 100 contas free admitidas, 200 scans/mês, 2.000 campos/mês e 200 MiB de tabelas/índices dos schemas public e app_private. O gateway também limita a 20.000 acessos à integração/mês somados entre contas free. Contas admitidas permanecem contabilizadas mesmo inativas. As reservas free usam trava transacional global para impedir disputas concorrentes. Ao atingir um limite, novas operações free falham com mensagem; não há contratação automática nem exclusão do histórico.

Esses números são políticas do aplicativo, não uma garantia de custo zero. Tráfego, autenticação, consultas e o Cron também consomem recursos. A infraestrutura precisa permanecer em planos gratuitos com limites impostos pelo provedor; não habilitar cobrança por excedente. O administrador também consome recursos reais e não pode ultrapassar os limites físicos dos provedores. A regra comercial de isenção não substitui autenticação, prévia, confirmação, validação ou auditoria.

## Administração privada

A lista de administradores fica em `app_private.admins`, inacessível aos clientes, inclusive service_role via RPC pública. Não há promoção por email, metadados do usuário ou papel de dono de workspace. Concessão/revogação exige acesso administrativo ao banco e registra auditoria em `app_private.admin_audit`.

Exemplo para um operador autorizado, após verificar a identidade:

```sql
insert into app_private.admins(user_id,reason)
values ('UUID-VERIFICADO','Concessão autorizada pelo proprietário');
```

Para suspender novas operações free, sem apagar histórico:

```sql
update app_private.plan_policy set paused=true where singleton;
```

O dashboard exibe o plano e o consumo. O painel de atividades consulta a cada 15 segundos com atividade e 60 segundos sem atividade; consultas pausam com aba oculta ou offline. O andamento de alterações consulta a cada 15 segundos e também pausa nessas condições.

Testes em `tests/database/free-plan.test.ts` cobrem isolamento de privilégios, confirmação idempotente, renovação mensal, cotas, capacidade global, auditoria administrativa e limite de leitura do scan. Não simulam saturação real dos serviços externos.

## Plano e consumo na conta

A migration 017 adiciona `/dashboard/plan`, acessível na barra lateral perto do email. A página apresenta consumo, limites, renovação e revisão de troca. No momento, os únicos planos são Free e Administrador; não há checkout ou plano pago fictício. Usuários comuns veem Free e a indisponibilidade de upgrade pago. Somente contas previamente habilitadas em `app_private.admins` podem alternar entre os dois.

A escolha fica em `app_private.plan_selection`, no banco, e vale para todas as sessões/dispositivos até outra troca. `is_admin` avalia a habilitação administrativa e o plano escolhido; selecionar Free não remove a habilitação para voltar. A RPC valida autenticação, elegibilidade, plano anterior e idempotência; cada confirmação é auditada em `app_private.plan_changes`. O formulário exige revisão e confirmação explícita. Prévia desatualizada é rejeitada; repetição de uma confirmação antiga não desfaz uma escolha posterior.

A troca não limpa contadores. Consumo administrativo não é contabilizado nas cotas Free; a UI informa essa distinção. Sites e operações ativas são totais atuais. A mudança para Free exige finalizar/cancelar operações ativas para não interromper trabalho em andamento. Sites e histórico existentes permanecem mesmo acima do novo limite, mas novas operações seguem as cotas. Revogar a habilitação administrativa prevalece sobre qualquer seleção salva.

## Administrator usage and external allowances

Migration `20260922000200_admin_usage_visibility.sql` meters Administrator scans,
confirmed CMS fields (including additional slug writes), preparation requests and
integration credential accesses separately from Free quotas. Reservations are
idempotent and transactional. Failed transactions do not increment counters;
confirmed reservations remain counted after cancellation. Monthly UTC buckets
retain history. Admin requests are counted per minute, without commercial limits.
The plan page combines that month's Free and Admin usage for an administrator;
switching back to Free continues to show/enforce only the original Free counters.
Earlier Administrator activity was not metered and is explicitly excluded; the
page shows when tracking started, rather than backfilling guessed usage.

Global capacity is available only in the active Administrator plan. It reflects
exactly the existing Free admission/reservation guards and the current measured
size of public/app_private tables and indexes. It is not Supabase billing usage.

External quotas are separate. A manual Webflow check performs one authenticated
GET for a site the user can access, reads only validated rate-limit headers, and
shows the remaining requests and observation time. No retry, polling, body logging
or token exposure. A 429 may report a genuine zero; missing/invalid headers remain
unavailable. It is a point-in-time minute allowance, not a monthly balance.
The current Supabase app credentials and Gemini generation key do not provide
organization/project billing balances; the UI links to the official usage pages
instead of presenting estimated or hardcoded Free-tier allowances as real quotas.
