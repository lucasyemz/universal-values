---
title: "E-mail de recuperação"
status: atual
tags: [replaceall, guia]
---

# E-mail de recuperação

Template PT-BR: `reset-password.pt-BR.html`.

No Supabase, abra Authentication → Emails → Reset Password. Use o assunto **Crie uma nova senha · ReplaceAll** e cole o conteúdo completo do HTML no corpo. Salve e solicite um novo e-mail pelo aplicativo para testar; não reutilize um link já consumido.

Este arquivo está configurado para desenvolvimento em `http://localhost:3000`. Abra o link no computador onde o app está rodando. Antes de usar em homologação/produção, substitua **as duas ocorrências** dessa origem pela URL HTTPS confiável daquele ambiente. Não altere o template de um projeto compartilhado com produção para localhost.

Preserve `{{ .TokenHash }}` no parâmetro `token_hash` e `{{ .Token }}` no código alternativo. Não substitua por `ConfirmationURL`: a aplicação verifica o token ao confirmar a nova senha. Não foi alterada a configuração remota do Supabase.

Layout com tabelas, estilos inline, fontes de sistema e marca textual, sem imagens remotas, rastreadores ou JavaScript. A marca textual permanece legível mesmo com imagens bloqueadas. Não promete um prazo de validade diferente do configurado no Supabase. Validar entrega e aparência no cliente de e-mail utilizado; renderização de navegador não equivale a compatibilidade com todos os clientes.
