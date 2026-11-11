# Relatório — 001 Scaffold base
Marco: M1 · Spec: [`docs/specs/001-scaffold-base.md`](../specs/001-scaffold-base.md) · QA: [`docs/qa/001-scaffold-base.md`](../qa/001-scaffold-base.md)
Branch: `feat/001-scaffold-base` · Commit: `0be0e33` · Data: 2026-11-11

## Linha do tempo
| Etapa | Resultado |
|---|---|
| Specifier | Spec escrita com 5 perguntas de produto; todas respondidas pelo usuário (sugestões aceitas) |
| Coder | Implementado; 31 testes, lint ok |
| Cleaner | 1 refatoração (404 duplicada → `renderNotFound`) |
| Hardener | 4 problemas corrigidos; 39 testes, lint ok |
| QA | **APROVADO** — 15/15 critérios, incluindo visuais |

## Decisões de produto (respostas do usuário)
1. Rodapé: "Os grupos marcados como “Fictício · demo” servem apenas para demonstrar a plataforma." (substitui "Nenhum dado é enviado a servidores").
2. Página 500: "Ops" / "Algo deu errado" / "Tivemos um problema ao carregar esta página. Tente de novo em instantes." / "Voltar ao início"; `<title>` "Erro · Pace Paulista".
3. Hero: "grupos cadastrados" (no lugar de "grupos no protótipo") — aplicado na 002.
4. "Sem cadastro para começar." mantido — aplicado na 002.
5. "Entrar no grupo" aponta para `/conta/entrar?next=/grupos/<slug>%23participar` (404 até o M5, aceito) — aplicado na 002.

## Coder
**Arquivos criados**
- Raiz: `.gitattributes` (`* text=auto eol=lf`), `.gitignore`, `.editorconfig`, `.env.example`, `.prettierrc.json`, `.prettierignore`, `eslint.config.js` (flat), `vitest.config.js`, `package.json`, `package-lock.json`.
- `src/`: `app.js` (`createApp({ beforeErrorHandlers })`, gancho só para testes), `server.js`, `config/env.js` (`parseEnv` + `env`), `middlewares/locals.js` (`res.renderPage`, `currentPath`, `nav`, `year` no fuso `TZ_APP`), `middlewares/notFound.js`, `middlewares/errorHandler.js`, `modules/pages/pages.routes.js`, `views/helpers.js` (`P` literal, `ic`, `currentNav`), `views/layout.ejs`, partials `header`, `footer`, `track-deco`, `page-head`, pages `home` (vazia), `404`, `500`.
- `public/css/app.css` (bloco da linha 1 + linhas 7–354 do protótipo, byte a byte), `public/js/app.js` (só o toggle do menu).
- Testes: `tests/domain/view-helpers.test.js`, `tests/domain/env.test.js`, `tests/http/scaffold.test.js`.

**Dependências**: express ^5.3, ejs ^7, dotenv ^18, zod ^4; dev: vitest ^5, supertest, eslint ^10, @eslint/js, globals, eslint-config-prettier, prettier ^3. Versões mais novas que as citadas no AGENTS.md; todos os testes passam.

**Observações**
- Fora da spec: `.prettierignore` ganhou `*.md` e `.claude/` (sem isso o `prettier --check` falhava nos .md). Aceito; não altera comportamento.
- Não rodado `git add --renormalize .` (arquivos já commitados não tinham CRLF).

## Cleaner
- `notFound.js` / `errorHandler.js`: resposta 404 duplicada extraída para `renderNotFound(res)`. Sem mudança de comportamento.
- Nada mais a limpar.

## Hardener
| Problema | Severidade | Correção | Teste |
|---|---|---|---|
| Erro após a resposta começar deixava a requisição pendurada (risco de DoS) | média | `errorHandler`: se `res.headersSent`, `next(err)` | `scaffold.test.js` › "erro depois de a resposta ter começado" |
| 4xx (400/413, `statusCode` 404) viravam 500 e eram logados | baixa/média | `statusOf(err)`: aceita 400–599; 404 → página não encontrada; outros 4xx → página genérica mantendo status; só 5xx loga | `scaffold.test.js` › "erros de cliente (4xx)" |
| `TZ_APP` inválido derrubava todas as páginas | média | `env.js`: `refine(isValidTimeZone)`; processo não sobe | `env.test.js` |
| `ic(name, cls)` inseria `cls` cru em `class="…"` (XSS futuro) | baixa | `cls` precisa casar `/^[\w -]*$/` | `view-helpers.test.js` |

Verificado OK: path traversal e URL malformada → 404; `<%= %>` para dados; `x-powered-by` desligado; sem script inline; erro de env cita só o nome da variável.

**Riscos aceitos**: `npm audit` — 4 moderados (GHSA-g3hv-75wg-m249, minimatch via eslint 10), só devDependencies (`--omit=dev` = 0). Correção rebaixaria para eslint 9; reavaliar quando sair eslint 10.x corrigido.
Pendências por marco: ver [`docs/PENDENCIAS.md`](../PENDENCIAS.md).

## QA
APROVADO. Detalhes e evidências em [`docs/qa/001-scaffold-base.md`](../qa/001-scaffold-base.md). Pulados `db:up`/`migrate`/`seed` (inexistentes no M1; Docker não funcionando na máquina).
