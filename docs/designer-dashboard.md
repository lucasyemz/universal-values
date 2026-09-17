# Designer e dashboard: conexão e histórico central

## Ativar localmente

1. Aplique `supabase/migrations/20260917000900_designer_dashboard.sql` no projeto Supabase. A implementação/testes locais não aplicam migrations no ambiente remoto.
2. Inicie o dashboard com `npm run dev` (porta 3000) e a extensão com `npm run designer:dev` (porta 1337).
3. Recarregue a extensão pelo Webflow **Launch development app**. O cabeçalho deve mostrar **v0.5**.
4. Na home da extensão, clique em **Abrir dashboard e autorizar**. Entre na conta do Universal Values, se necessário. Depois do login, use novamente o link da extensão para retornar ao site correto.
5. Se o site estiver vinculado em mais de um workspace, escolha o destino. Se não estiver vinculado, faça a conexão pelo fluxo existente.
6. Revise o site e o acesso por 8 horas, confirme e gere o código. Cole-o no campo de conexão da extensão.
7. Use **Páginas estáticas** para buscar, preparar uma prévia e confirmar no Designer. Use **Conteúdo do CMS** para abrir o fluxo existente em tela cheia.
8. As novas prévias e seus eventos aparecem em **Páginas estáticas → Histórico** no dashboard. Recarregue essa página para acompanhar resultados recentes; na extensão use **Atualizar atividade**.

O código é uma credencial temporária e restrita a um único site. Nunca o coloque em URLs, logs, commits ou mensagens. Ele fica em `sessionStorage` da extensão, sem cookies de terceiros. Fechar a sessão/aba pode exigir reconexão; o acesso pode ser revogado no dashboard. A sessão atual do Webflow continua determinando o que a extensão pode efetivamente editar.

## Configuração de hospedagem

- `DESIGNER_ALLOWED_ORIGINS` é uma configuração do servidor Next.js. Informe origens **exatas** autorizadas para o iframe da extensão; padrão: `http://localhost:1337,https://webflow-ext.com`. Se a hospedagem da extensão usar outro domínio, configure a origem correspondente. Sem curingas ou origem `null`.
- `DESIGNER_DASHBOARD_URL` é uma configuração do **build da extensão**, passada pelo ambiente do terminal. Padrão: `http://localhost:3000`. O script não carrega `.env.local`. Para um bundle de produção, defina a URL HTTPS pública antes de executar `npm run designer:bundle`.
- Não distribua o bundle local para produção: ele aponta para localhost. Nenhuma credencial Supabase/Webflow é incluída no bundle.
- Navegadores podem restringir chamadas de extensões hospedadas em HTTPS para localhost. Para testar um bundle hospedado, use dashboard HTTPS e reconstrua o bundle com essa origem.
- A API `/api/designer` usa Authorization Bearer e não cookies. A política CORS complementa a autorização; o banco exige a credencial mesmo em chamadas fora de navegador.

## Persistência e segurança

- `designer_sessions`: autorização do owner por site, hash SHA-256 de código aleatório de 256 bits, validade de 8 horas, revogação explícita. O hash não fica disponível em SELECT para o usuário.
- `designer_session_audit`: criação/revogação idempotentes com usuário e horário do servidor.
- `designer_changes`: plano imutável, termo pesquisado, sessão/usuário/site, horário de criação, expiração e eventos. A própria linha é o registro auditável da prévia; resultados guardam horário de recebimento do servidor.
- RLS permite leitura do histórico somente a owners do workspace. DML direto é revogado. A função restrita `designer_gateway` valida sessão, site e membership em cada chamada, inclusive após revogação do papel de owner.
- O dashboard não usa service role nem envia tokens do Webflow à extensão. O código autoriza a extensão a registrar dados no Universal Values; não concede novas permissões no Webflow.
- Prévias são salvas antes de serem apresentadas para confirmação. Confirmação e intenção de escrita são persistidas antes de chamar `setText`. Sem confirmação central do registro de envio, não há escrita.
- O banco rejeita um segundo dispatch para o mesmo nó/plano. Timeout não produz reenvio automático. Resultado incerto fica no histórico para inspeção; registro central indisponível impede novas escritas.
- Os resultados são **informados pelo cliente Designer após releitura**, não uma verificação independente do servidor Webflow. O usuário autenticado que autorizou a sessão é o responsável pelo registro, não uma identidade Webflow verificada por ID token.
- Recarregar a extensão perde a prévia em memória; ela permanece no histórico, mas não é reaplicada automaticamente. Planos antigos não são transferidos para sessões novas.
- Permanece a limitação do protótipo: sem transação de lote nem compare-and-swap do provedor. Uma operação pode ser parcial; não editar a mesma página simultaneamente.

## Escopo desta entrega

Home da extensão com site/página, conexão, entrada para textos estáticos, link direto para CMS e atividade recente. Dashboard em tela cheia com autorização/revogação e histórico detalhado antes/depois. Busca e confirmação de conteúdo estático permanecem na extensão.

O histórico anterior continua local e exportável; não é importado automaticamente. Scans sem prévia ainda não ficam persistidos no histórico central. Componentes, Rich Text, Localization e busca entre nós continuam fora do teste. Não há publicação automática.

Próximas evoluções: vinculação automática com ID token verificado do Webflow, diagnóstico dos nós ignorados, histórico de scans e revisão de grandes lotes em tela cheia com retorno ao Designer.
