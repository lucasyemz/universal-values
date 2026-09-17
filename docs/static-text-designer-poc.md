# Teste de textos estáticos no Webflow Designer

## Preparação

Esta é uma extensão experimental separada do dashboard, no mesmo repositório. Use um site de teste **sem Localization**. Não precisa de token, migration ou credenciais do Supabase. A autenticação e as permissões de edição são as da sessão aberta no Designer.

1. Nas configurações do Workspace Webflow, abra **Apps & Integrations → Develop**.
2. Habilite **Designer Extension** no app de desenvolvimento (ou registre um app de teste com essa capacidade).
3. Instale esse app no site de teste. Não basta reconectar o OAuth do CMS: a capacidade Designer Extension precisa estar habilitada.
4. No terminal deste repositório, execute `npm run designer:dev`.
5. Abra uma página estática no Designer, fora da edição de componentes. Em **Apps**, abra o app e escolha **Launch development app**.
6. O servidor da extensão é `http://localhost:1337`. Abrir apenas esse endereço fora do Designer não permite acessar o site.

Para gerar um pacote para upload manual: `npm run designer:bundle`. O arquivo é `extensions/webflow-designer/bundle.zip`. Gerar o pacote não o instala nem publica. O servidor serve o build produzido ao iniciar; depois de editar código, rode `npm run designer:build` e recarregue a extensão.

## Roteiro de teste manual

Na página de teste, prepare manualmente:

- Um parágrafo: `Aqui minha EMPRESA está no meio do texto.`
- Outro: `EMPRESA e EMPRESA trabalham juntas.`
- Uma ocorrência em negrito, mantendo `EMPRESA` inteira dentro do mesmo elemento de texto.
- Um texto em minúsculas `empresa`, que não deve entrar no grupo.

Busque `EMPRESA`. Verifique o contexto e as menções iguais. Selecione uma ocorrência e preencha outro nome, ou use **Preencher todas as ocorrências**. Vazio significa remover somente o trecho; espaços e pontuação ao redor são preservados.

Gere a prévia, revise cada nó antes/depois, marque as duas confirmações e aplique. A aplicação é uma ação manual do usuário. Confira texto e formatação no Designer e exporte o histórico local. A extensão não publica o site.

Teste também:

1. Gere uma prévia, altere o texto manualmente no Designer e tente aplicar: deve acusar conflito.
2. Gere uma prévia e troque de página: deve bloquear a aplicação.
3. Remova uma ocorrência deixando o novo trecho vazio.
4. Reabra a extensão e exporte o histórico, verificando a persistência no mesmo navegador/origem.
5. Confira que links, negrito e demais elementos ao redor permanecem intactos.

## Escopo e limites

- Uma página estática aberta, até 2.000 elementos, 100 menções e 10.000 caracteres por nó.
- Busca literal sensível a maiúsculas. Uma ocorrência única também pode ser testada.
- Apenas `StringElement.getText/setText`. Nunca substitui o HTML ou o conteúdo do elemento pai.
- Ignora CMS, bindings dinâmicos, componentes, Rich Text, DOM personalizado, código e embeds. Não busca trechos que atravessam nós/formatos distintos. Texto dentro de links pode aparecer; o endereço do link não é alterado.
- Não controla Localization: os tipos oficiais utilizados não oferecem um contexto de locale nessa integração. O teste exige confirmação de site sem Localization e não deve ser usado em sites multilíngues.
- Histórico **local**, não centralizado, não autenticado nem inviolável. Não é o mecanismo de auditoria de produção. Se o armazenamento estiver indisponível ou cheio, a escrita é bloqueada. Exportação contém os textos antes/depois.
- Confirmação expira em 15 minutos. O aplicativo valida contexto, origem estática e valor atual antes de escrever, persiste intenção antes do envio e relê depois. Um resultado incerto não é reenviado automaticamente.
- Bloqueio entre janelas da mesma origem via Web Locks. Não há transação/compare-and-swap no Designer; outro editor pode modificar conteúdo entre leitura e escrita. O teste deve ser feito sem edição simultânea. Lotes podem terminar parcialmente aplicados.
- Atualização por atribuição absoluta e identificação da operação evita reaplicar a mesma substituição. Recarregar a extensão perde a prévia, mas preserva o histórico local.
- Reversão pela extensão e integração com Managed Values/dashboard não fazem parte desta prova de conceito.

## Validação local e próxima etapa

Testes automatizados cobrem seleção exata, remoção, Unicode, preservação do entorno, conflitos, expiração, confirmação, auditoria antes da escrita, falha de armazenamento e retomada sem reenvio. O adaptador é testado com uma API simulada. Build e tipos oficiais verificam a integração estática, mas **não substituem o teste real no Designer**.

Após validar a API no site de teste: autenticar a extensão com o backend, persistir planos/auditoria no Supabase com isolamento por workspace, resolver contexto de locale e ampliar os tipos compatíveis.

Referências oficiais:

- https://developers.webflow.com/designer/reference/designer-api/getting-started
- https://developers.webflow.com/designer/reference/string-element/setText
- https://developers.webflow.com/apps/designer/guides/configuring-your-app
