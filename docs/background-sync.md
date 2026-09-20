# Sincronização CMS em segundo plano

## Modelo de hospedagem: Supabase Free

O executor de produção é uma Supabase Edge Function (`cms-worker`), acionada pelo Supabase Cron a cada minuto. Cada chamada processa no máximo **um campo** e encerra. Não exige Background Worker pago no Render nem computador ligado. O dashboard precisa de hospedagem própria; esta configuração resolve o executor CMS.

A primeira etapa normalmente começa no próximo minuto; operações com vários campos avançam em chamadas posteriores. Cooldown, falhas, concorrência e limites do provedor podem aumentar essa espera. O perfil inicial prioriza simplicidade e limites previsíveis, não alto volume.

No Free, a documentação consultada informa 500 mil invocações incluídas e limite de 150 segundos por execução. Um agendamento por minuto consome cerca de 43.200 chamadas em 30 dias, mesmo sem operações. As cotas são compartilhadas com outras funções e recursos do projeto; não há garantia de gratuidade para qualquer volume. Projeto pausado, cotas esgotadas ou falhas do serviço interrompem o processamento até recuperação.

Fontes: [agendamento](https://supabase.com/docs/guides/functions/schedule-functions), [cotas](https://supabase.com/docs/guides/platform/billing-on-supabase), [limites](https://supabase.com/docs/guides/functions/limits).

## O que já está preparado no repositório

- `npm run worker:edge:build` gera `supabase/functions/cms-worker/index.js` e `worker.js`. O build usa as versões instaladas registradas no package-lock, não lê `.env.local` e não executa operações. Os arquivos gerados são ignorados pelo Git: sempre compile antes de publicar.
- `supabase/config.toml` define a função e seu entrypoint.
- `supabase/cron/cms-worker.sql` prepara a chamada via Vault + pg_net e um job inicialmente **desativado**. Reexecutar o script preserva a ativação existente e não duplica o job.
- A função exige `x-worker-secret`, um segredo privado de 64 caracteres hexadecimais. Chaves públicas e sessões comuns não autorizam execução. `verify_jwt = false` desativa somente o verificador JWT do gateway: o handler faz sua própria autenticação antes de acessar o banco.
- A fila da migration 015 continua sendo usada. Não há migration de tabelas nova nesta etapa; o SQL do Cron é uma configuração separada de infraestrutura.

## Ativação no Supabase

### 1. Conferir a fila e o banco

Mantenha as migrations 001–015 aplicadas. A migration 015 foi verificada no ambiente durante a ativação local; confira o estado do projeto de destino. Não recrie a chave `WEBFLOW_TOKEN_ENCRYPTION_KEY`: os tokens existentes dependem dela.

Revise as operações confirmadas antes de ativar o Cron. A ativação permite processar as que já foram confirmadas e não estão pausadas. Prévias não são executadas.

### 2. Configurar segredos da Edge Function

Em **Edge Functions → Secrets**, configure:

| Nome | Valor |
| --- | --- |
| `WEBFLOW_TOKEN_ENCRYPTION_KEY` | A mesma chave de criptografia do dashboard |
| `CMS_WORKER_CRON_SECRET` | Novo segredo aleatório com 32 bytes, codificado em 64 caracteres hexadecimais minúsculos |

Gere o segredo em um terminal privado, por exemplo com `openssl rand -hex 32`, e guarde-o em seu gerenciador de senhas. Não cole segredos em chats ou arquivos versionados.

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidos pelo ambiente hospedado do Supabase. Não tente cadastrar manualmente nomes com prefixo reservado `SUPABASE_`. A chave privada usada no worker local não precisa ser copiada para uma variável pública.

### 3. Compilar e publicar a função

Com a CLI Supabase disponível, na raiz do projeto:

```bash
nvm use
npm ci
npm run worker:edge:build
npx supabase login
npx supabase functions deploy cms-worker --project-ref SEU_PROJECT_REF
```

Substitua `SEU_PROJECT_REF` pelo identificador do projeto existente. O deploy usa `supabase/config.toml`. Publicar a função não cria nem ativa o Cron.

### 4. Configurar Vault e preparar o agendamento

No Supabase Vault, cadastre (ou atualize pelos mesmos nomes, sem duplicatas):

- `cms_worker_project_url`: `https://SEU_PROJECT_REF.supabase.co`, sem barra final.
- `cms_worker_cron_secret`: exatamente o mesmo segredo cadastrado como `CMS_WORKER_CRON_SECRET` na função.

Execute `supabase/cron/cms-worker.sql` no SQL Editor como administrador (`postgres`). Ele habilita pg_cron e pg_net. O Vault já deve estar disponível no projeto Supabase. O job criado chama uma função restrita ao administrador, sem colocar o segredo no texto do agendamento.

Confira o job sem ativá-lo:

```sql
select jobid, jobname, schedule, active
from cron.job where jobname = 'cms-worker-every-minute';
```

Na primeira instalação, `active` deve ser `false`.

### 5. Testar configuração sem escrever no CMS

```sql
select public.invoke_cms_edge_worker('check');
```

Esse comando retorna o ID da requisição HTTP, não o resultado final. Consulte depois:

```sql
select id, status_code, timed_out, error_msg, content
from net._http_response
where id = ID_RETORNADO;
```

O esperado é HTTP 200 com `{"ok":true,"mode":"check"}`. O diagnóstico verifica autenticação, formato da chave de criptografia e permissão de acessar o gateway da migration 015. Ele usa uma lease nula que o banco rejeita antes de qualquer reserva ou heartbeat. Não verifica decriptação de cada conexão nem altera Webflow.

401: confira os dois segredos do Cron. 503: confira os segredos da função, migration 015, permissões ou conexão. Erros não devolvem tokens nem o conteúdo das operações.

### 6. Ativar explicitamente

Após conferir o diagnóstico e a fila:

```sql
select cron.alter_job(jobid, active := true)
from cron.job where jobname = 'cms-worker-every-minute';
```

Encerre o worker Node local para manter um único executor habitual. As leases existentes protegem a transição caso duas chamadas coincidam. No dashboard, confira o sinal recente e confirme uma alteração em um site de testes. Feche a aba e retorne após alguns minutos para conferir os resultados.

Para pausar o agendador:

```sql
select cron.alter_job(jobid, active := false)
from cron.job where jobname = 'cms-worker-every-minute';
```

Pausar impede novas chamadas agendadas; uma chamada já enviada pode terminar. A fila e o histórico permanecem no banco. Reative o mesmo job para continuar.

## Segurança, limites e recuperação

O executor compartilha o mesmo código do worker local. A identidade é obtida da operação armazenada; a chamada HTTP aceita apenas `{"mode":"run"}` ou `{"mode":"check"}`, sem IDs de usuários ou operações. A RPC restrita a service_role valida propriedade, conexão, status, lease e cursor.

Cada invocação chama `processWorkerTurn` uma única vez. As chamadas de rede têm prazo compartilhado de 90 segundos e mantêm seus timeouts individuais. Isso deixa margem para o limite de 150 segundos, mas encerramentos por CPU, memória ou infraestrutura ainda são possíveis. Não há laço infinito nem tarefa desacoplada da resposta HTTP.

A marca de despacho é persistida antes do PATCH. Se o processo morrer após o envio, a próxima chamada aguarda a lease expirar e reconcilia o estado por leitura, sem reenviar uma escrita de resultado incerto. Conflito, falha ou incerteza pausa as etapas restantes; a retomada exige a confirmação existente no dashboard. O histórico e a auditoria são os mesmos do executor Node. Nenhum site é publicado automaticamente.

A confirmação de Managed Values salva o valor central desejado; somente a execução com verificação confirma a sincronização das fontes. A migração de hospedagem não muda essa distinção.

## Monitoramento e painel

O painel flutuante aparece quando há processos ativos, pendências ou conclusão recente. Pode ser minimizado e lembra a preferência neste navegador. Consulta a fila a cada 15 segundos com atividade e 60 segundos sem atividade; pausa as consultas quando a aba está oculta ou offline; isso não acelera o Cron, que executa a cada minuto.

O heartbeat vem do gateway de reserva. Ausência de sinal por três minutos indica executor indisponível. Confira também os logs da Edge Function e `net._http_response`: sucesso do job Cron significa que a requisição HTTP foi enfileirada, não que o CMS foi atualizado. O modo `check` não atualiza heartbeat.

Scans de leitura ainda dependem da página de execução aberta, e a extensão Designer mantém seu fluxo. Esta etapa cobre somente alterações CMS: scans confirmados para edição, Managed Values, resoluções e reversões.

## Alternativa local

Para desenvolvimento, mantenha `.env.local` com `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e a chave de criptografia existente. Use `npm run dev` para o dashboard e `npm run worker` em outro terminal. Esse modo depende do computador ligado. `npm run worker:build` apenas compila e `npm run worker:start` roda o bundle Node já compilado com variáveis fornecidas pelo ambiente.

## Validação

O bundle também foi carregado em Deno com transporte simulado, validando autenticação privada e diagnóstico sem acesso ao CMS. Para repetir após compilar: `npx deno run --allow-env --config supabase/functions/cms-worker/deno.json scripts/edge-worker-smoke.mjs`.

Os testes automatizados verificam autenticação HTTP, diagnóstico sem execução, limite de uma etapa, payload inválido e erros sem segredos; os testes do executor com PostgreSQL/PGlite cobrem reserva exclusiva, recuperação após despacho, perda de resposta após commit, pausa/retomada, cooldown, cancelamento e revogação. O teste SQL do agendamento usa substitutos locais para Vault/Cron/pg_net; a integração real depende da instalação acima.

A preparação local não equivale à publicação ou ativação remota. O teste final deve ser feito com alteração explicitamente confirmada pelo usuário em um site de testes.

## Implantação verificada em 20/09/2026

No projeto `nxibjpprjorchjeoudss` (Universal Value), a função `cms-worker` foi publicada pela CLI, os dois segredos privados foram configurados e o Vault recebeu a URL do projeto e o segredo dedicado do Cron. O segredo dedicado também foi guardado no `.env.local` privado, ignorado pelo Git. A chave de criptografia existente foi preservada.

O diagnóstico direto retornou 401 sem credencial e 200 no modo autenticado `check`. A chamada de diagnóstico por Vault + pg_net também retornou 200, sem timeout. O job `cms-worker-every-minute` (ID 1, usuário postgres) foi ativado somente após conferir a fila vazia. Nenhum worker Node local estava em execução. Não foram criadas ou confirmadas alterações CMS para validar a implantação.

Primeira execução automática observada: 20/09/2026 18:55 UTC, Cron `succeeded`, resposta HTTP 200 `{"ok":true,"idle":true}`, heartbeat atualizado às 18:55:02 UTC e zero operações pendentes. Isso confirma a infraestrutura em fila vazia; a próxima alteração real deve ser preparada e confirmada pelo usuário pelo fluxo normal.
