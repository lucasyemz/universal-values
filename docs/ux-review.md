# Revisão de UX — setembro de 2026

## Mudanças implementadas

- Retornos de scans, alterações, Managed Values, sites e prévias usam `FreshLink`: link semântico com aparência de botão secundário e navegação nativa para consultar o servidor novamente. Mantém abrir em nova aba/copiar endereço. Não usa `history.back()` nem restaura a rota antiga do cache cliente do Next.
- O shell recarrega os dados quando o navegador restaura uma página pelo back-forward cache.
- Ações como abrir Managed Value, selecionar autorização, consultar prévia e paginar CMS receberam área de clique e aparência de botão. Referências dentro do texto continuam links.
- O preenchimento em grupo tem atalho direto para a prévia. Edições individuais continuam disponíveis. A confirmação do CMS segue obrigatória, mas agora é o próprio botão explícito, sem checkbox redundante. O servidor continua validando `confirmed=yes`.
- Marcação manual de revisão apresenta o efeito e a quantidade antes do botão, e salva em um clique, com validação, auditoria e chave idempotente. Pode ser desfeita em Revisados. Não salva edições ainda digitadas.
- A opção de reconectar Webflow fica em uma seção de ajuda, evitando sugerir reconexão em toda aplicação normal.
- O término oferece acesso direto aos pendentes/Managed Value com dados atualizados.

## Revisão automática

Migration 019: o registro durável de um resultado `applied` ou `already_applied` marca as ocorrências correspondentes como revisadas na mesma transação, com auditoria por etapa. Não depende de manter a página aberta. Aplica-se a edições por scan e às fontes observadas de Managed Values. Falhas, conflitos e incertezas não geram marcação; reversões não geram novas marcações automáticas.

Também registra o novo conteúdo verificado para reconhecê-lo em scans futuros, usando origem, valor e conteúdo completo exatos. Transformações de imagens que não correspondam ao valor esperado não marcam automaticamente o conteúdo futuro. Para imagens/galerias, o executor fornece a mesma serialização da detecção. Conteúdo externo diferente permanece pendente quando detectado em um novo scan.

A migration concilia resultados históricos bem-sucedidos. Decisões manuais existentes, incluindo voltar para pendentes, têm prioridade: a conciliação não sobrescreve seus registros. Reexecução de uma etapa não desfaz essa decisão nem duplica auditoria.

## Atualizar não é executar outro scan

Voltar recarrega revisões e resultados atuais do banco. O conteúdo capturado pelo scan continua sendo um registro histórico. Buscar novas edições feitas no Webflow exige um novo scan; a UI explica essa diferença.

## Validação

332 testes passaram, lint, build Next/TypeScript, bundle Edge e smoke Deno aprovados. Testes de banco incluem aplicação, já aplicado, falhas, conflitos, incertezas, Managed Values, reconhecimento em novo scan, conciliação histórica, preservação de pendentes manuais e idempotência. Não foram feitas alterações de teste em conteúdo real do Webflow. A inspeção visual autenticada não foi concluída: o acesso ao navegador inteiro foi bloqueado pela revisão automática de permissões por expor outras abas privadas.
