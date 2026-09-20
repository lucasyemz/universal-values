# Landing page

A exportação do Awesomic é servida como HTML independente no mesmo deploy do Next.js, preservando estilos e animações sem interferir no dashboard.

## URLs

- `/`: landing pública. Rewrite interno em `next.config.ts` serve `/landing/index.html`, mantendo `/` no navegador.
- `/login`: login existente; usuários autenticados seguem para `/dashboard`.
- `/dashboard`: aplicativo protegido por autenticação.

## Arquivos

`public/landing/` contém `index.html`, `styles.css`, `fonts.css`, `script.js` e `assets/`. CSS, JavaScript, fontes e SVGs foram preservados. No HTML, os caminhos dos arquivos usam `/landing/`, a folha de fontes agora é carregada e os CTAs de acesso levam a `/login`. A demonstração e os links de seção permanecem locais.

O `server.mjs` e o `package.json` do ZIP são exclusivos do servidor independente e não são necessários: execute `npm run dev` na raiz do projeto. O ZIP original permanece intacto.

Para atualizar, substituir os arquivos nessa pasta mantendo caminhos e CTAs. Usar links HTML normais entre landing e aplicativo, incluindo links de retorno à landing; não usar `next/link` para esse documento independente. A landing fica fora do proxy de sessão e não consulta o Supabase.

Pro e Agency permanecem apresentados como planos futuros, sem checkout. Esta integração não adiciona cadastro público nem planos pagos.
