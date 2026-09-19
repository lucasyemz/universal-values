# Sincronização CMS em segundo plano

## Ativação local

1. Aplique `supabase/migrations/20260919001500_background_cms_worker.sql` após as migrations 001–014. A migration mantém operações confirmadas na fila e pausa as que já tinham erro no último campo. Ela remove a permissão de executar etapas pelo navegador; atualize as abas antigas após aplicá-la.
2. No `.env.local`, configure `SUPABASE_SERVICE_ROLE_KEY` com a credencial privada de servidor do mesmo projeto Supabase. Ela pertence somente ao ambiente do worker, nunca ao navegador, Git ou variáveis `NEXT_PUBLIC_*`. Mantenha a mesma `NEXT_PUBLIC_SUPABASE_URL` e `WEBFLOW_TOKEN_ENCRYPTION_KEY` do dashboard. Não crie outra chave de criptografia.
3. Terminal do dashboard: `nvm use` e `npm run dev`.
4. Outro terminal: `nvm use` e `npm run worker`. Mantenha esse processo ativo. Ele compila o executor em `.worker/` (ignorado pelo Git) e consulta a fila a cada cinco segundos. `npm run worker:build` apenas compila, sem executar operações.

Fechar a aba ou o navegador não para o worker. Fechar o terminal, desligar o computador ou encerrar o processo pausa a execução; a fila permanece no banco. Reinicie com `npm run worker` para recuperar as etapas pendentes. Não há daemon instalado automaticamente.

## Funcionamento

A confirmação existente é o ponto de entrada na fila; uma prévia não é executada. O worker processa uma etapa de cada vez usando a identidade armazenada na operação, sem cookies ou sessão do navegador. Uma função restrita a `service_role` verifica autorização, conexão e status, reserva a etapa e fornece somente o contexto daquela operação. O gateway revalida proprietário e conexão antes de autorizar o envio.

A escrita continua usando os mesmos planos imutáveis, leitura do conteúdo atual, marca de despacho durável e verificação após escrita de Managed Values. A marca impede reenvio se o processo morrer entre o PATCH e a persistência do resultado. Nesse caso, o novo worker relê: se o conteúdo corresponde, registra sucesso já aplicado; se não corresponde, registra resultado incerto sem reenviar.

A fila persiste cursor, lease, pausa, prazo de retry e auditoria. Ela respeita o prazo solicitado pelo Webflow e mantém intervalo mínimo de cinco segundos entre etapas de uma operação. Uma falha, conflito ou resultado incerto pausa as etapas restantes para revisão. No dashboard, **Confirmar continuação das etapas pendentes** volta a colocá-las na fila; não refaz as etapas com resultado registrado. Erros de infraestrutura pausam o passo atual; a retomada reconcilia sua marca de despacho antes de qualquer novo envio.

O painel apenas consulta progresso e sinal recente do worker. Ausência de sinal por três minutos mostra executor indisponível; isso é um diagnóstico de atividade, não garantia de que um passo específico está rodando. Uma operação cancelada não é coletada. Cancelar durante lease ativo ou despacho sem resultado continua bloqueado até reconciliação.

## Hospedagem

O worker exige um processo Node.js 22+ persistente com acesso ao Supabase e à API Webflow. Publique o dashboard e o worker com a mesma versão do código/migrations. Em produção, use supervisão de processo com reinício automático, segredos privados e logs restritos. Hospedar apenas as rotas Next.js em funções efêmeras não inicia esse executor. O worker pode ficar em um serviço separado; nenhum endpoint público de execução foi criado.

O escopo desta etapa é a fila de alterações CMS (incluindo Managed Values, resolução e reversões). Scans de leitura e a extensão Designer mantêm seus fluxos anteriores. Não há publicação automática do site.

## Validação manual

Em um site de testes, prepare e confirme uma alteração com pelo menos dois campos. Feche a aba imediatamente; mantenha apenas o worker rodando. Depois reabra o dashboard e confira os resultados e o CMS. Repita interrompendo o worker entre etapas e reiniciando-o. Nunca use esse teste para autorizar uma nova escrita de resultado incerto: a reconciliação deve somente ler o campo.

Os testes automatizados exercitam o worker contra PostgreSQL embutido e um Webflow simulado, sem navegador: reserva exclusiva, recuperação antes/depois de despacho, perda da resposta após commit, pausa/retomada, cooldown, cancelamento, revogação de acesso e rollback de auditoria. A validação com credenciais reais depende da ativação acima.

## Painel flutuante de processos

O dashboard tem um botão **Processos** no canto inferior direito. Ele só aparece quando há processos ativos, pendências ou uma conclusão recente (por cerca de 15 segundos). Sem atividade, fica oculto e continua consultando a fila. Ele começa minimizado; a preferência de expandir/minimizar é salva neste navegador por usuário. O painel consulta a fila a cada cinco segundos, mostra operações do usuário autenticado e permite abrir os detalhes. Navegar entre páginas mantém o painel disponível.

São exibidas alterações confirmadas, scans em andamento ou pausados e os resultados das operações acompanhadas durante a sessão do painel. Resultados com conflitos ou incertezas aparecem como pendências. A consulta é somente leitura e usa a sessão normal e as políticas RLS, sem a chave do worker. O painel não executa nem retoma operações. Os scans ainda precisam da página de execução aberta; sincronizações confirmadas dependem do worker.

Não é necessária uma migration adicional para este painel. Ele usa a migration 015 da fila em segundo plano.
