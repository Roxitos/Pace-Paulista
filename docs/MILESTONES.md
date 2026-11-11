# Marcos — Pace Paulista v1

Cada marco passa pelo pipeline (`/pipeline Mx`). O Specifier pode quebrar um marco em várias specs.

| Marco | Entrega | Pronto quando |
|---|---|---|
| **M1** Scaffold | Express + EJS, layout, header/footer, CSS extraído do protótipo, 404/500, lint e vitest configurados | `npm run dev` mostra a home estática igual ao protótipo |
| **M2** Banco | docker compose, pool, `scripts/migrate.js`, migrations 001–005, seed dos 11 grupos demo | `migrate` + `seed` idempotentes; teste lê os 11 grupos |
| **M3** Leitura | `/`, `/grupos` com filtros via query string, `/grupos/:slug`, `/zonas`, `/mapa`, `/sobre` | Todos os filtros do protótipo funcionam sem JS |
| **M4** Compatibilidade | `/encontrar` com `calcMatch` no servidor | Mesmos resultados do protótipo para as mesmas respostas |
| **M5** Contas | criar conta, entrar, sair, sessão no Postgres, `requireAuth`, usuário no header | Fluxo completo coberto por teste HTTP |
| **M6** Escrita | cadastrar grupo, participar/sair, `/meus`, excluir conta | Fluxo criar conta → cadastrar → participar → sair → excluir passa |
| **M7** Melhorias de JS | filtros ao vivo (`/api/grupos`), modal de participar, toast, menu mobile | Igual ao protótipo com JS; continua funcionando sem |
| **M8** Produção | helmet/CSP, rate limit, revisão final de segurança, deploy | QA aprova em ambiente publicado |
