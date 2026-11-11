# Relatório — 004 Leitura do banco: repo de grupos, home e /zonas
Marco: M3 · Spec: [`docs/specs/004-leitura-banco-home-zonas.md`](../specs/004-leitura-banco-home-zonas.md) · QA: [`docs/qa/004-leitura-banco-home-zonas.md`](../qa/004-leitura-banco-home-zonas.md)
Branch: `claude/pipeline-m3-start-059610` (sem commit ainda) · Data: 2026-11-11

## Linha do tempo
| Etapa | Resultado |
|---|---|
| Specifier | M3 dividido em 4 specs (004 → 005 → 006 → 007); 11 perguntas, 3 bloqueantes (P3 → 005, P4 → 006, P10 → 007). 004 liberada com os defaults de P1/P5 |
| Coder | Implementado; CA1–CA12 cobertos; 249 testes (20 arquivos), lint ok |
| Cleaner | Só testes/config: `insertUser` comum, `home.test.js` enxuto, timeout de teste 30 s; `src/` intacto |
| Hardener | Nenhum problema explorável; nada alterado. 3 bordas de baixa severidade viram pendência (M6) |
| QA | **APROVADO** — 12/12 critérios; home byte a byte igual à HEAD; 360 px sem scroll; sem JS ok |

## Decisões de produto
Respostas do usuário (2026-11-11) às perguntas do Specifier para o M3:
- **P1** (home sem grupos): mantém o comportamento atual (pace omitido, "0 grupos", destaques vazios). Default aceito.
- **P5** (etiqueta do card): demo → "Fictício · demo"; real com dono → "Cadastrado por {display_name}"; real sem dono → sem etiqueta. Default aceito.
- **P3** (aplica-se à 005): **aprovado** trocar os toggles de zona com `aria-pressed` por checkboxes com o mesmo visual (CSS `:has`), para funcionar sem JS. CLAUDE.md §8 a atualizar junto com a 005.
- **P4** (aplica-se à 006): **visitante deslogado não vê o contato do grupo**. Local/rótulo/formato seguem o default da spec (linha "Contato" no fim da "Ficha do treino", texto puro, oculta quando vazio). Como login só chega no M5, na 006 o contato não aparece para ninguém; a exibição para logados entra no M5. Spec 006 a ajustar antes do Coder.
- **P10** (aplica-se à 007): mantém o título "Status do protótipo"; banco ATIVO, login PENDENTE, item "navegador" removido (default).
- P2, P6, P7, P8, P9, P11: ainda abertas (defaults nas specs 005–007).

## Coder
**Novos**
- `src/modules/groups/groups.repo.js`: `listPublished()` — `LEFT JOIN users` (só `display_name`) e `LEFT JOIN memberships`; `participants = (base_participants + COUNT(m.user_id))::int`; `start_time` via `to_char(…,'HH24:MI')`; `ORDER BY array_position($1::text[], g.zone), g.name, g.slug` com `$1 = ZONA_ORDEM`; colunas explícitas, sem `id`/`owner_id`/e-mail/hash/role.
- `src/modules/groups/groups.service.js`: `listPublishedGroups()`.
- `src/views/pages/zonas.ejs`: `PageZonas` do protótipo, CTA `/grupos?zona=<z>`.
- Testes: `tests/db/groups-repo.test.js`, `tests/http/zonas.test.js`, `tests/http/banco-indisponivel.test.js` (`vi.mock` do repo rejeitando).

**Alterados**
- `src/modules/pages/pages.service.js`: sem import de `db/seeds`; `getHomeData(groups)` e `getZonesData` puras; `loadHomeData`/`loadZonesData` leem o banco.
- `src/modules/pages/pages.routes.js`: `/` lê do banco; nova `GET /zonas`.
- `src/views/partials/demo-tag.ejs` e `group-card.ejs`: etiqueta por grupo (P5).
- `tests/helpers/db.js` (`seedDemo`), `tests/db/helpers.test.js`, `tests/domain/pages-service.test.js`, `tests/http/home.test.js`, `tests/http/scaffold.test.js`, `README.md` (`dev`/`start` exigem Postgres).

**Observações**
- `tests/db/migrate.test.js` já oscilava antes (timeout de 5 s no Windows + Docker).
- O rodapé (spec 001) sempre menciona "Fictício · demo", mesmo sem demos; o CA5 verifica só a etiqueta e o aviso da home.
- `tests/http` passa a exigir Postgres (exceto `banco-indisponivel.test.js`).
- Ordem dos locais em `/zonas` depende da collation de `citext` (desempate por slug).

## Cleaner
- `vitest.config.js`: `testTimeout`/`hookTimeout` 30 s (só configuração, nenhuma asserção mudou).
- `tests/helpers/db.js`: `insertUser(pool, displayName, opts)` substitui 3 cópias (`home`, `zonas`, `groups-repo`).
- `home.test.js`: `beforeAll` usa `getHome()`; `DEMO_TAG` no topo; teste "sem grupos publicados não mostra Infinity/NaN" movido de `zonas.test.js` para cá.
- Mantidos de propósito: `groups.service.js` como repasse (camadas), hooks de banco explícitos em cada arquivo, `insertUser` próprio de `schema.test.js` (fora do diff).

## Hardener
Nenhuma correção. Conferidos: SQL parametrizado e colunas explícitas; `pending`/`rejected` fora de totais, zonas, destaques, `hasDemo` e contagens; escape com `<%= %>` (`owner_name`, nome, local, descrição); `encodeURIComponent` nos slugs; 500 sem stack/URL; testes só em banco `*_test`; dono excluído → etiqueta some.

| Problema | Severidade | Correção | Teste |
|---|---|---|---|
| `start_time = '24:00'` aceito pelo Postgres → `fmtHora` lança e `/` responde 500 (se o grupo estiver em destaque; na 005, qualquer um) | baixa (só por SQL direto) | Pendência M6: migration `CHECK (start_time < '24:00')` + zod `([01]\d\|2[0-3]):[0-5]\d` | temporário (removido) |
| Dia repetido em `days` aceito ("Sáb, Sáb") | baixa | Pendência M6: zod deduplica | temporário (removido) |
| `name`/`location`/`display_name` só com espaços passam nos CHECKs | baixa | Pendência M5/M6: `.trim()` antes de `min()` | — |

Riscos aceitos e pendências geradas: ver [`docs/PENDENCIAS.md`](../PENDENCIAS.md).

## QA
APROVADO. `npm ci`, migrate 2x, seed (0/11, já existiam), 249 testes, lint ok. Usou o Postgres do checkout principal (porta 5432) em vez de `db:up` no worktree. CA1: `/` idêntico byte a byte à HEAD b9336f3 (21551 bytes), 404 idem. CA10 real com banco na porta 1. CA11 no Chrome headless 360×800, claro/escuro, com e sem JS. `/zonas` fiel ao protótipo em 87 elementos (360 e 1280 px). Detalhes em [`docs/qa/004-leitura-banco-home-zonas.md`](../qa/004-leitura-banco-home-zonas.md).

**Sugestões não bloqueantes**: rodapé com "Fictício · demo" sem demos; favicon ausente (404 no console, desde 001); `/zonas` poderia usar consulta agregada (M9); manter `display_name` no `GROUP BY` se o join mudar; CSP ainda ausente (M8); `name:` fixo no `docker-compose.yml` para rodar `db:up` em worktrees.
