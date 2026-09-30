---
title: "Configuração dos logins — guia para retomar"
status: atual
tags: [replaceall, guia]
---

# Configuração dos logins — guia para retomar

Preparado em **29/09/2026** para continuar em **30/09/2026**.

## Onde paramos

O código está preparado para e-mail/senha, Google, Apple, Microsoft e Webflow. Na última consulta, e-mail estava habilitado e Google/Apple/Microsoft desativados no Supabase. Webflow está desativado por configuração até validarmos a integração real.

Lint, TypeScript, 945 testes e build passaram na última implementação. Isso valida o código local; **ainda não testamos os logins sociais e o envio de e-mails de ponta a ponta**. Não houve configuração remota, publicação, migration, commit ou push nesta etapa de autenticação.

Este documento é uma checklist operacional. Os contratos técnicos estão em [Autenticação](authentication.md) e [Login Webflow](webflow-login.md).

## Ordem sugerida

1. URLs do aplicativo e Supabase.
2. Cadastro por e-mail, SMTP e recuperação.
3. Google.
4. Microsoft.
5. Webflow, com uma URL HTTPS pública para o adaptador.
6. Apple, que tem mais requisitos de configuração.

| Login | Onde configurar | O que separar antes | Pendência |
| --- | --- | --- | --- |
| E-mail/senha | Supabase Auth e serviço SMTP | Remetente, domínio e credenciais SMTP | Configuração e teste de entrega |
| Google | Google Cloud + Supabase | Acesso ao projeto Google | Client ID, secret e callback |
| Microsoft | Microsoft Entra + Supabase | Permissão para registrar um aplicativo | Client ID, secret e callback |
| Webflow | **App ReplaceAll Login separado** + Supabase | Credenciais de login e URL da Edge Function | Scope, callback e provedor customizado |
| Apple | Apple Developer + Supabase | Acesso habilitado para Sign in with Apple | App ID, Services ID, chave e client secret |
| ChatGPT | Fora desta etapa | Disponibilidade para nosso aplicativo não confirmada | Não implementado |

Guarde segredos no painel correspondente ou em um gerenciador de senhas. Não cole Client Secrets, chaves privadas ou códigos de recuperação no chat, neste guia ou no Git.

## 1. Base: ambiente e URLs

No `.env.local`, para testes locais:

```env
APP_ORIGIN=http://localhost:3000
WEBFLOW_LOGIN_ENABLED=false
```

As variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` já fazem parte da configuração existente. Não substitua as credenciais do projeto sem necessidade.

- [ ] Salvar `.env.local` e reiniciar `npm run dev`.
- [ ] Abrir o projeto correto no [Supabase Dashboard](https://supabase.com/dashboard).
- [ ] Authentication → URL Configuration → Site URL: `http://localhost:3000` para este ambiente de teste.
- [ ] Adicionar aos Redirect URLs:

```text
http://localhost:3000/auth/callback
http://localhost:3000/auth/reset-password
```

Se o projeto Supabase já atender produção, não troque sua Site URL para localhost; mantenha a URL de produção e use um ambiente de teste apropriado. Quando publicarmos, registrar os equivalentes HTTPS e configurar `APP_ORIGIN` no host.

### Não confundir os callbacks

| URL | Onde cadastrar |
| --- | --- |
| Callback **exibido pelo Supabase** no provedor | No painel do Google, Microsoft, Apple ou Webflow |
| `http://localhost:3000/auth/callback` | Redirect URLs do Supabase; retorno ao ReplaceAll |
| `http://localhost:3000/auth/reset-password` | Redirect URLs do Supabase; recuperação |
| Callback existente `/api/connectors/webflow/callback` | Continuar registrado no Webflow para conexão com sites |

Copie o callback do painel em vez de deduzir seu formato, principalmente para o provedor customizado Webflow.

## 2. E-mail, cadastro e recuperação

### Cadastro

- [ ] Supabase → Authentication → Sign In / Providers → Email: habilitar login/cadastro por e-mail.
- [ ] Habilitar **Confirm email**.
- [ ] No template **Confirm signup**, manter o link com `{{ .ConfirmationURL }}`.
- [ ] Fazer o teste de confirmação no mesmo navegador em que iniciou o cadastro, devido ao fluxo PKCE atual.

### Envio de e-mail

- [ ] Escolher um serviço de envio com SMTP.
- [ ] Verificar o domínio remetente e configurar os registros DNS pedidos pelo serviço.
- [ ] No Supabase → Authentication → e-mails/SMTP, cadastrar host, porta, usuário, senha, nome e e-mail do remetente.
- [ ] Conferir limites de envio, validade dos códigos e proteção contra abuso antes de lançamento público.

O remetente padrão do Supabase tem restrições de teste; não considerar entrega para usuários reais pronta sem validar SMTP. Os nomes exatos dos menus podem variar no painel.

### Template de recuperação — obrigatório para nosso código

Em **Email Templates → Reset Password**, usar para desenvolvimento:

```html
<h2>Recuperar acesso ao ReplaceAll</h2>
<p>Clique abaixo para criar uma nova senha:</p>
<p>
  <a href="http://localhost:3000/auth/reset-password?token_hash={{ .TokenHash }}">
    Criar nova senha
  </a>
</p>
<p>Ou informe este código junto com seu e-mail:</p>
<p><strong>{{ .Token }}</strong></p>
<p>Se você não solicitou esta recuperação, ignore este e-mail.</p>
```

- [ ] Salvar o template.
- [ ] Em produção, substituir localhost pela origem HTTPS definitiva.
- [ ] Não usar `ConfirmationURL` neste template de recuperação: nosso formulário verifica o token ao confirmar a nova senha.

### Testes com uma conta destinada a teste

- [ ] `/signup`: criar conta, receber confirmação e entrar.
- [ ] `/forgot-password`: solicitar recuperação e conferir caixa de entrada/spam.
- [ ] Abrir o link: deve mostrar o formulário sem consumir a recuperação.
- [ ] Confirmar uma nova senha com 12–128 caracteres e entrar novamente.
- [ ] Tentar reutilizar o link: deve ser rejeitado.
- [ ] Solicitar outro e-mail e testar o código em `/auth/reset-password`.
- [ ] Testar código expirado/inválido e senhas diferentes.
- [ ] Solicitar recuperação para endereço sem conta: a tela não deve revelar se existe cadastro.

## 3. Google

Painéis: [Google Cloud Console](https://console.cloud.google.com/) e Supabase → Authentication → Providers → Google.

- [ ] Selecionar/criar um projeto no Google Cloud.
- [ ] Configurar a tela de consentimento/Google Auth Platform com nome do app e contatos.
- [ ] Criar um OAuth Client ID do tipo **Web application**.
- [ ] Em **Authorized redirect URIs**, inserir o callback copiado do Supabase.
- [ ] Se solicitado, cadastrar a origem do app nos campos de origem correspondentes.
- [ ] Copiar Client ID e Client Secret diretamente para o provedor Google no Supabase.
- [ ] Habilitar e salvar.
- [ ] Em modo Testing, adicionar a conta de teste aos usuários permitidos no Google.
- [ ] Reabrir `/login`: deve aparecer **Continue with Google**.
- [ ] Testar autorização, cancelamento e novo login na mesma conta.
- [ ] Antes do lançamento, concluir os requisitos de publicação/verificação indicados no painel Google.

[Documentação oficial](https://supabase.com/docs/guides/auth/social-login/auth-google).

## 4. Microsoft

Painéis: [Microsoft Entra](https://entra.microsoft.com/) → App registrations e Supabase → Providers → Azure/Microsoft.

- [ ] Registrar um aplicativo.
- [ ] Selecionar o público desejado: contas pessoais e organizacionais, se quisermos atender ambos.
- [ ] Cadastrar uma Redirect URI do tipo **Web**, com o callback do Supabase.
- [ ] Copiar **Application (client) ID**.
- [ ] Em Certificates & secrets, criar um client secret.
- [ ] Copiar o **Value** do segredo, não o Secret ID, e registrar sua expiração no gerenciador de senhas/calendário.
- [ ] Informar Client ID e Client Secret no Supabase.
- [ ] Conferir a configuração de tenant para que corresponda ao público escolhido; não restringir a um tenant empresarial se queremos contas pessoais também.
- [ ] Habilitar, salvar e testar **Continue with Microsoft**.
- [ ] Se o público inclui ambos, testar uma conta pessoal e uma conta corporativa autorizada.

O código já solicita o escopo `email`. [Documentação oficial](https://supabase.com/docs/guides/auth/social-login/auth-azure).

## 5. Webflow — app exclusivo para login

Use **ReplaceAll Login**, separado do app CMS, pois o formulário atual aceita um callback por app.

### No Webflow

- [ ] Workspace → Apps & Integrations → App Development → app ReplaceAll Login.
- [ ] Habilitar `authorized_user:read` no app de login.
- [ ] Adicionar o callback exibido pelo provedor customizado do Supabase.
- [ ] Preservar o app original, o callback CMS e `WEBFLOW_REDIRECT_URI`.

### No Supabase

Authentication → Providers → New Provider → Manual configuration / OAuth2:

| Campo | Preencher |
| --- | --- |
| Identifier | `custom:webflow` |
| Name | `Webflow` |
| Client ID / Client Secret | Credenciais do app ReplaceAll Login |
| Authorization URL | `https://webflow.com/oauth/authorize` |
| Token URL | `https://api.webflow.com/oauth/access_token` |
| UserInfo URL | `https://nxibjpprjorchjeoudss.supabase.co/functions/v1/webflow-userinfo` |
| Scopes | `authorized_user:read` |
| Email optional | Desativado |
| Attribute mapping | Vazio |

### Dependência para o teste real

**O Supabase hospedado não acessa o nosso localhost.** Usamos a Edge Function `webflow-userinfo` no próprio projeto. O dashboard pode continuar local, sem túnel.

- [ ] Definir a URL pública e disponibilizar o adaptador.
- [ ] Configurar o provedor e seu callback.
- [ ] Manter PKCE inicialmente; confirmar compatibilidade da troca de código antes de alterar qualquer opção.
- [ ] Para o teste controlado, ativar `WEBFLOW_LOGIN_ENABLED=true` no dashboard local; reiniciar.
- [ ] Testar novo usuário, usuário existente e cancelamento.
- [ ] Validar eventual confirmação de e-mail exigida pelo Supabase. O Webflow não fornece comprovação de e-mail verificado; não forçar essa informação para passar no teste.
- [ ] Conferir que entrar novamente não afetou a conexão CMS existente.
- [ ] Se falhar, retornar a flag para `false` enquanto diagnosticamos.

O login identifica o usuário. A seleção e conexão dos sites continuam no fluxo existente. A compatibilidade completa entre Webflow e o provedor customizado **ainda precisa do teste real**.

Detalhes e limites em [Login Webflow](webflow-login.md).

## 6. Apple

Painéis: [Apple Developer](https://developer.apple.com/account/) e Supabase → Providers → Apple.

- [ ] Verificar se a conta Apple Developer tem acesso aos recursos necessários para Sign in with Apple.
- [ ] Configurar o App ID com a capacidade Sign in with Apple.
- [ ] Criar/configurar um **Services ID** para autenticação web, associado ao App ID.
- [ ] Cadastrar domínio e Return URL conforme o callback fornecido pelo Supabase.
- [ ] Criar uma chave de Sign in with Apple; guardar o arquivo privado com segurança.
- [ ] Separar Team ID, Key ID e Services ID.
- [ ] Gerar o client secret conforme o procedimento oficial e cadastrá-lo no Supabase com o Services ID.
- [ ] Registrar a data de expiração e a tarefa de renovação do segredo.
- [ ] Habilitar e testar **Continue with Apple**, incluindo a opção de ocultar o e-mail.

Não confundir o arquivo de chave privada com o client secret gerado. Confirmar os requisitos de domínio, conta e eventuais custos no painel antes de contratar algo.

[Documentação oficial](https://supabase.com/docs/guides/auth/social-login/auth-apple).

## 7. Checklist final

- [ ] Somente provedores configurados estão visíveis.
- [ ] Usuário novo consegue entrar e iniciar o fluxo normal de workspace.
- [ ] Usuário existente volta à conta correta.
- [ ] Mesmo e-mail em métodos distintos respeita as regras de verificação/vinculação do Supabase.
- [ ] Cancelar OAuth e usar callback inválido não concede uma sessão.
- [ ] Cadastro/recuperação entregam e-mails reais e rejeitam tokens reutilizados.
- [ ] Login não inicia scans nem modifica/publica sites.
- [ ] URLs, remetente e templates usam o domínio correto antes de produção.
- [ ] Segredos e `.env.local` permanecem fora do Git.

## Como retomar comigo amanhã

Pode enviar:

> Vamos continuar pelo docs/login-setup-pt-BR.md. Já configurei [itens concluídos]. Falta [pendências]. Vamos testar um login por vez, começando por e-mail e Google. Para Webflow, vamos reutilizar o app atual.

Não envie segredos. Basta informar quais etapas concluiu e, se houver erro, a mensagem sem tokens ou códigos.
