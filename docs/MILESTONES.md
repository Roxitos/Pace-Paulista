# Marcos — Pace Paulista v1

Cada marco passa pelo pipeline (`/pipeline Mx`). O Specifier pode quebrar um marco em várias specs.

| Marco | Entrega | Pronto quando |
|---|---|---|
| **M1** Scaffold | Express + EJS, layout, header/footer, CSS extraído do protótipo, 404/500, lint e vitest configurados | `npm run dev` mostra a home estática igual ao protótipo |
| **M2** Banco | docker compose, pool, `scripts/migrate.js`, migrations 001–005, seed dos 11 grupos demo | `migrate` + `seed` idempotentes; teste lê os 11 grupos |
| **M3** Leitura | `/`, `/grupos` com filtros via query string, `/grupos/:slug`, `/zonas`, `/mapa`, `/sobre` | Todos os filtros do protótipo funcionam sem JS |
| **M4** Compatibilidade | `/encontrar` com `calcMatch` no servidor | Mesmos resultados do protótipo para as mesmas respostas |
| **M5** Contas ✅ | criar conta, entrar, sair, sessão no Postgres, `requireAuth`, usuário no header (+ excluir conta, spec 012) | Fluxo completo coberto por teste HTTP — **concluído** (specs 009–012, QA aprovado) |
| **M6** Escrita ✅ | cadastrar grupo, participar/sair, `/meus` | Fluxo criar conta → cadastrar → participar → sair passa — **concluído** (specs 013–015, QA aprovado) |
| **M7** Melhorias de JS ✅ | filtros ao vivo (`/api/grupos`), modal de participar, toast, menu mobile, mapa sem recarregar (`/api/mapa/:slug`) | Igual ao protótipo com JS; continua funcionando sem — **concluído** (specs 016–018, QA aprovado) |
| **M8** Produção ✅ | helmet/CSP, rate limit, revisão final de segurança, deploy | QA aprova em ambiente publicado — **concluído** (specs 019–021; no ar desde 2026-11-17 em https://pace-paulista.onrender.com/) |
| **M9** Conteúdo real | curadoria de grupos reais, reivindicar grupo, edição pelo dono, `last_confirmed_at` + job de validade, "Informar problema", moderação. Detalhes em `PENDENCIAS.md` | Nenhum grupo demo publicado em produção; grupos sem confirmação há mais de 120 dias sinalizados ou fora da busca |
| **M11** Mapa real ✅ | `/mapa` com Leaflet + OSM, aba "Mapa" no menu, migration 008 (`groups.lat/lng`) e coordenadas dos demos (spec 024); marcar o ponto no cadastro: spec 025 | Pinos nos locais certos, seleção sem recarregar, SVG como fallback sem JS — **implementado (aguarda Cleaner/Hardener/QA)**; entrou antes do M10 |
| **M10** Recuperar senha (atual, antes do M9) | `/conta/recuperar` e `/conta/redefinir/:token`, tabela `password_resets` (migration 009), `modules/email` com envio por API HTTP (`fetch`), rate limit | Fluxo pedir link → e-mail (transporte em memória nos testes) → nova senha → login passa; resposta neutra para e-mail sem conta; token expirado/usado recusado; QA aprova em produção com o provedor real |
