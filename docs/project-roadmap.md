---
title: "Estado e próximos passos"
status: planejamento
tags: [replaceall, planejamento]
---

# Estado e próximos passos

[Mapa do projeto](project-map.md) · [Checklist de homologação e produção](production-checklist.md)

Referência: 29/09/2026. Esta nota organiza o trabalho; não autoriza deploys nem comprova o estado remoto atual.

## Situação conhecida

- Dashboard, extensão, scans, revisão contextual, Variáveis e worker existem no código; consultar os guias por funcionalidade.
- Login Google, Webflow e recuperação por e-mail foram confirmados pelo usuário no ambiente local. SMTP Brevo foi configurado pelo usuário. Não registrar chaves, links de recuperação ou senhas nas notas.
- Microsoft foi adiado após dificuldade de configuração da conta/tenant. Não tratar esse provedor como validado.
- A interface avisa sobre a cota de sites da conta; reconexão de sites existentes permanece disponível.
- Hospedagem do dashboard, domínio e separação de homologação ainda precisam de decisão. Cloudflare foi discutido como opção, não selecionado nem validado como destino.

## Ordem proposta

- [ ] Revisar o diff acumulado e salvar uma versão em Git quando solicitado.
- [ ] Validar ponta a ponta com conta comum e site de teste: login → workspace → conexão → busca → seleção → edição → aplicação → histórico.
- [ ] Validar o mesmo fluxo suportado na extensão, incluindo persistência de sessão.
- [ ] Escolher hospedagem compatível com o Next.js do projeto, considerando custo e limites atuais do fornecedor.
- [ ] Definir domínio, projeto Supabase de destino e isolamento dos dados de homologação.
- [ ] Configurar callbacks, origens, e-mails e bundle da extensão para esse ambiente.
- [ ] Verificar schema, worker, Cron, recuperação e observabilidade antes da publicação.
- [ ] Executar os critérios do [checklist de produção](production-checklist.md) em homologação.

## Fora da próxima entrega

Paginação por grupos continua [proposta](design/group-pagination.md). Novas escritas por agentes/MCP, SEO, leitura de embeds e publicação automática não devem ser inferidas deste roteiro. Mudanças de escopo exigem decisão própria.

## Como atualizar

Mover uma tarefa para concluída exige registrar data, ambiente e evidência. Resultados automatizados ficam em [verificação](verification.md) / `docs/qa/`; contratos duradouros ficam no guia da funcionalidade. Evitar transformar esta nota em diário de logs.
