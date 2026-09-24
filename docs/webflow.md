# Conexão Webflow

## Ativação em desenvolvimento

1. Configure o esquema completo conforme [o guia do banco](../supabase/README.md). Não configure um ambiente novo aplicando apenas a migration original do OAuth.
2. No Webflow, crie um App com o building block **Data Client** em **Apps & Integrations → App Development**.
3. Configure os scopes `sites:read`, `cms:read` e `cms:write`. Reconecte autorizações antigas para permitir alterações confirmadas.
4. Cadastre a URL de retorno exata: `http://localhost:3000/api/connectors/webflow/callback`. Use o mesmo host e porta para acessar a aplicação. Se o Webflow exigir HTTPS para seu ambiente, use um domínio/túnel HTTPS e ajuste também `WEBFLOW_REDIRECT_URI`.
5. Execute `npm run setup:webflow`. Isso prepara as variáveis locais e gera uma chave de criptografia se ausente. Valores existentes são preservados.
6. No `.env.local`, preencha `WEBFLOW_CLIENT_ID` e `WEBFLOW_CLIENT_SECRET` com os dados do App. Nunca coloque estes valores em variáveis `NEXT_PUBLIC_*`, no Git ou no chat.
7. Reinicie `npm run dev`, entre e abra **Configurações do Webflow** no menu de conta para o workspace desejado.
8. Revise e confirme a conexão de leitura e escrita do CMS, autorize no Webflow, escolha um site, revise e confirme o vínculo.
9. Abra **Explorar CMS**. A estrutura vem do cache identificado por data; atualize explicitamente quando necessário. O conteúdo dos itens é carregado por ação explícita.

Documentação oficial: [OAuth Webflow](https://developers.webflow.com/data/reference/oauth-app), [scopes](https://developers.webflow.com/data/reference/scopes) e [CMS](https://developers.webflow.com/data/reference).

## Comportamento

- O conector fica em `src/connectors/webflow`.
- Consultas usam GET. Edições confirmadas usam PATCH do CMS staged conforme [o guia de alterações](cms-changes.md). A troca do código OAuth usa POST; não há chamada de publicação.
- Conteúdo exibido vem do endpoint CMS staged e pode diferir do site publicado. Rascunhos, arquivados e locale são identificados.
- Rich text é mostrado como texto escapado, nunca como HTML executável.
- A coleção consultada precisa pertencer ao site selecionado. A autorização do site é verificada novamente antes de consultar seu CMS.
- Nesta etapa, gerenciar conexões e explorar conteúdo é restrito ao proprietário que autorizou a conexão. Compartilhamento de credenciais entre membros fica para uma etapa posterior.
- Uma nova autorização pode reconectar um site existente, mediante nova prévia e confirmação. Prévias desatualizadas não sobrescrevem conexões mais recentes.

## Persistência e segurança

A migration adiciona `webflow_connections`, `webflow_credentials`, `sites`, `site_connection_previews` e `integration_audit_events`. Escritas diretas de usuários são bloqueadas; RPCs conferem propriedade e identidade.

O OAuth usa state aleatório, cookie HttpOnly/SameSite=Lax, expiração e vínculo com o usuário e workspace. Uma claim atômica no banco impede duas trocas do mesmo código. Apenas um callback chega ao provedor; repetições concluídas retornam à conexão existente. O fluxo explícito de conexão e a autorização no Webflow representam o consentimento para armazenar a conexão.

Tokens são criptografados com AES-256-GCM e contexto que inclui conexão, workspace e autor. A tabela de credenciais não permite SELECT direto. A RPC só fornece o ciphertext ao proprietário autorizado; a chave de descriptografia fica exclusivamente no servidor. Mesmo um proprietário que invoque RPCs diretamente não consegue forjar um token válido: a aplicação rejeita envelopes adulterados e revalida os sites/coleções no provedor antes de usar a conexão.

Mantenha `WEBFLOW_TOKEN_ENCRYPTION_KEY` estável e guardada no gerenciador de segredos do deploy. Todos os processos da aplicação precisam usar a mesma chave. Perder ou trocar essa chave impede a leitura de tokens existentes e exige nova autorização. A ferramenta de setup não gira uma chave existente.

Eventos de início da autorização, claim, conclusão, prévia e vínculo ficam registrados, sem tokens, códigos OAuth ou dados de conteúdo. Transações do banco garantem idempotência e atomicidade com auditoria. As mutações de vínculo exigem uma prévia imutável de 15 minutos e confirmação explícita.

## Falhas e limites

- Se o processo cair entre obter o token e persistir a credencial, inicie uma nova autorização. Não há transação distribuída com Webflow nem repetição automática da troca de códigos.
- Token revogado/permissões insuficientes: a UI orienta reautorizar.
- HTTP 429: a UI informa a espera baseada em Retry-After; não há loop de tentativas.
- Timeout de rede: 15 segundos por chamada.
- Não existe rotina de limpeza de autorizações incompletas/prévias expiradas nesta etapa; definir retenção antes de produção.
- Conexão/revogação ficam em Configurações do Webflow. Revogar ou substituir a conexão invalida o cache associado; metadados antigos nunca restauram permissão. Scans e detecção estão em [scans](scans.md).
- O fluxo interativo de conexão não usa service role; o executor privado tem configuração própria em [background sync](background-sync.md).

## Verificação

`npm test` cobre scopes, resposta Zod, state, criptografia, erros do provedor, paginação, orquestração OAuth, RLS, idempotência, revogação de membership, conflitos e rollback de auditoria. O Webflow é simulado nos testes; a migration executa em PostgreSQL embutido.

Valide manualmente com um Webflow App real: autorização e cancelamento, sites vazios, seleção, consulta de mais de 25 itens, reconexão e token revogado. Verifique duas contas Supabase e acesso indevido por URL. Concorrência real entre múltiplas conexões PostgreSQL ainda deve ser verificada em desenvolvimento.

Nenhuma migration remota ou autorização Webflow é executada pelos testes.
