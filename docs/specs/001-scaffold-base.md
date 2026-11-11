# 001 — Scaffold base: Express 5 + EJS, layout, header/footer, CSS, 404/500 e ferramentas
Marco: M1 · Status: pronta para Coder

## Objetivo
Criar o esqueleto do monólito: servidor Express 5 com EJS, layout único com o header e o footer do protótipo, CSS do protótipo extraído para `public/css/app.css`, páginas 404 e 500, e ESLint + Prettier + vitest configurados. Ao final, `npm run dev` sobe o site e `/` mostra header e footer idênticos ao protótipo, com o miolo da home vazio (o conteúdo da home é a spec 002).

## Fora do escopo
- Conteúdo da home (hero, zonas, destaques, "Como funciona", CTA) → spec 002.
- Banco, `pg`, docker compose, migrations, seed (M2). `DATABASE_URL` e `SESSION_SECRET` **não** são validados neste marco.
- Sessão, login, CSRF, `requireAuth`, usuário/badge no header (M5).
- helmet/CSP e rate limit (M8).
- Qualquer outra página (`/grupos`, `/zonas`, `/sobre` etc.): os links do header/footer já apontam para as URLs finais e respondem **404** até os marcos seguintes. Isso é esperado.
- Toast, modal, filtros ao vivo (M7). Exceção: o toggle do menu mobile (ver "JS do cliente").

## Mudanças

### Banco
Nenhuma.

### Arquivos de raiz
- `.gitattributes` com exatamente:
  ```
  * text=auto eol=lf
  ```
- `.gitignore`: `node_modules/`, `.env`, `coverage/`.
- `.editorconfig`: `charset = utf-8`, `end_of_line = lf`, `indent_style = space`, `indent_size = 2`, `insert_final_newline = true`.
- `.env.example`: exatamente o bloco da §10 do `AGENTS.md` (as 5 variáveis), mesmo que só `NODE_ENV`, `PORT` e `TZ_APP` sejam lidas agora.
- `package.json`:
  - `"name": "pace-paulista"`, `"private": true`, `"type": "module"`, `"engines": { "node": ">=22" }`.
  - Dependências: `express@^5`, `ejs`, `dotenv`, `zod`.
  - devDependencies: `vitest`, `supertest`, `eslint`, `@eslint/js`, `globals`, `eslint-config-prettier`, `prettier`.
  - Nenhuma outra dependência (em particular, **sem** `express-ejs-layouts`; o layout é resolvido como descrito abaixo).
  - Scripts:
    | script | comando |
    |---|---|
    | `dev` | `node --watch src/server.js` |
    | `start` | `node src/server.js` |
    | `test` | `vitest run` |
    | `lint` | `eslint . && prettier --check .` |
    | `format` | `prettier --write .` |
    (`db:up`, `migrate`, `seed` entram no M2.)
- `eslint.config.js` (flat config): `@eslint/js` recommended + `eslint-config-prettier`; globals `node` para `src/`, `tests/`, `scripts/`, `*.config.js`; globals `browser` para `public/js/`; ignora `node_modules/`, `coverage/`, `docs/`.
- `.prettierrc.json`: `{ "singleQuote": true, "printWidth": 100, "endOfLine": "lf" }`.
- `.prettierignore`: `node_modules/`, `coverage/`, `docs/`, `public/css/app.css` (mantido byte a byte igual ao protótipo para facilitar comparação), `*.ejs`, `package-lock.json`.
- `vitest.config.js`: `environment: 'node'`, `include: ['tests/**/*.test.js']`.

### Configuração
- `src/config/env.js`: exporta `parseEnv(source)` (função pura, valida com zod) e `env` (= `parseEnv(process.env)` após `dotenv/config`).
  - `NODE_ENV`: `'development' | 'test' | 'production'`, default `'development'`.
  - `PORT`: inteiro 1–65535 (coerção de string), default `3000`.
  - `TZ_APP`: string, default `'America/Sao_Paulo'`.
  - Valor inválido → lança erro com a lista de variáveis inválidas (o processo não sobe).

### Servidor
- `src/app.js`: exporta `createApp()` que monta e devolve o app **sem** chamar `listen`:
  1. `app.set('view engine', 'ejs')`, `views` = `src/views`.
  2. `app.disable('x-powered-by')`.
  3. `express.static('public')` (caminho absoluto a partir do arquivo).
  4. Middleware `src/middlewares/locals.js` (ver abaixo).
  5. Rotas de `src/modules/pages/pages.routes.js`.
  6. `src/middlewares/notFound.js` e por último `src/middlewares/errorHandler.js`.
- `src/server.js`: só importa `createApp` e `env` e faz `app.listen(env.PORT)` com um log `Pace Paulista em http://localhost:<PORT>`.

### Rotas
| Método | Caminho | Auth | Resultado |
|---|---|---|---|
| GET | `/` | — | 200, renderiza `pages/home` dentro do layout (miolo vazio nesta spec; `title` = "Pace Paulista") |
| GET | `/css/app.css`, `/js/app.js` | — | arquivos estáticos |
| qualquer | rota inexistente | — | 404, renderiza `pages/404` |
| — | erro não tratado em qualquer rota | — | 500, renderiza `pages/500` |

### Layout (sem dependência nova)
- `src/middlewares/locals.js` adiciona `res.renderPage(view, locals = {})`: renderiza `pages/<view>` com `app.render` (promessa), depois renderiza `layout` passando `body` (HTML da página) + os mesmos locals, e envia. Status é o que estiver em `res.statusCode`.
- `locals.js` também define em `res.locals`: `currentPath` (= `req.path`), `nav` (= `currentNav(req.path)`), `year` (ano atual calculado no fuso `env.TZ_APP` via `Intl.DateTimeFormat`).
- Helpers estáticos de view ficam em `app.locals` (disponíveis em todo template): `ic`.

### Helpers de view — `src/views/helpers.js` (novo; funções puras)
- `P`: objeto de ícones **copiado literalmente** do protótipo (`const P = {...}`, linhas ~437–462 de `docs/prototipo.html`).
- `ic(name, cls = '')` → `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name]}</svg>` (mesmo HTML do protótipo). Nome inexistente → lança `Error('Ícone desconhecido: <nome>')`.
- `currentNav(path)` → chave de navegação para `aria-current`:
  | path | retorno |
  |---|---|
  | `/` | `'inicio'` |
  | `/grupos` e qualquer `/grupos/...` | `'grupos'` |
  | `/zonas` | `'zonas'` |
  | `/sobre` | `'sobre'` |
  | outros | `''` |

### Views
- `src/views/layout.ejs`: documento completo.
  - `<!doctype html>`, `<html lang="pt-BR">`, `<meta charset="utf-8">`, viewport igual ao do protótipo (`width=device-width,initial-scale=1,viewport-fit=cover`), `<title><%= title %></title>`.
  - Os 3 `<link>` de fontes **iguais** às linhas 3–5 do protótipo (preconnect + Google Fonts com Anton, Bebas Neue, Inter, JetBrains Mono).
  - `<link rel="stylesheet" href="/css/app.css">`.
  - `<%- include('partials/header') %>`, `<main id="view" tabindex="-1"><%- body %></main>`, `<%- include('partials/footer') %>`.
  - `<div id="toastRoot" aria-live="polite"></div>` (vazio, igual ao protótipo; `#modalRoot` fica para o M7).
  - `<script src="/js/app.js" defer></script>`. **Nenhum script inline.**
- `src/views/partials/header.ejs`: HTML das linhas 357–377 do protótipo, com estas trocas (todo o resto — classes, ids, SVG da marca, textos, `aria-*` — igual):
  - Hash → URL real: `#inicio`→`/`, `#grupos`→`/grupos`, `#zonas`→`/zonas`, `#sobre`→`/sobre`, `#encontrar`→`/encontrar`, `#cadastrar`→`/grupos/novo`, `#meus`→`/meus`.
  - `aria-current="page"` renderizado no servidor no link `[data-nav]` cujo valor é igual a `nav` (manter os atributos `data-nav`).
  - `#meusBtn` com `<%- ic('user') %>` dentro (sem badge neste marco).
  - Botão `.menu-btn` com `<%- ic('menu') %>` dentro (no protótipo era injetado por JS).
- `src/views/partials/footer.ejs`: HTML das linhas 381–401, com:
  - Mesmas trocas de hash → URL; `#mapa`→`/mapa`.
  - `<span id="yr">` com `<%= year %>` renderizado no servidor.
  - Texto do `.small` do primeiro bloco (substitui o do protótipo, conforme `AGENTS.md` §9): "Os grupos marcados como “Fictício · demo” servem apenas para demonstrar a plataforma."
- `src/views/partials/track-deco.ejs`: mesmo SVG de `TrackDeco()` (linha 585), com os 5 círculos (`r` 115,145,175,205,225) gerados por loop ou escritos literalmente — saída idêntica.
- `src/views/partials/page-head.ejs`: equivalente a `PageHead(kicker, title, text, extra)` (linhas 587–589). Recebe `kicker`, `title`, `text` (todos escapados com `<%= %>`) e `extra` (HTML interno de partial, `<%- %>`).
- `src/views/pages/home.ejs`: vazio nesta spec (a spec 002 preenche).
- `src/views/pages/404.ejs`: equivalente a `NotFound()` (linha 983): page-head com kicker "Ops", título "Página não encontrada", texto `message` ou, por padrão, "Esse endereço não existe."; extra `<p style="margin-top:20px"><a class="btn btn-primary" href="/">Voltar ao início</a></p>`.
- `src/views/pages/500.ejs`: mesmo formato do 404: kicker "Ops", título "Algo deu errado", texto "Tivemos um problema ao carregar esta página. Tente de novo em instantes.", extra com o botão "Voltar ao início" (`/`).

### Middlewares
- `notFound.js`: `res.status(404)` + `res.renderPage('404', { title: 'Página não encontrada · Pace Paulista' })`.
- `errorHandler.js` (assinatura de 4 args): se `err.status === 404` → mesma resposta do notFound (aceita `err.message` como `message` só se o erro for de domínio da aplicação; nesta spec, usar o texto padrão). Senão → `console.error(err)` e `res.status(500)` + `renderPage('500', ...)`. **Nunca** incluir `err.message` nem stack no HTML. Se a própria renderização falhar, responder `500` com texto puro `Erro interno.`

### CSS — `public/css/app.css`
- Conteúdo do `<style>` das linhas 7–354 de `docs/prototipo.html`, **copiado literalmente** (sem reformatar, sem renomear tokens, sem remover regras).
- No topo, antes dele, um bloco comentado `/* Base herdada do invólucro do protótipo (linha 1) */` com as regras do `<style>` da linha 1 copiadas literalmente (`:root{...safe-area...}`, `html{scroll-padding-top...}`, `body{margin:0;padding:0;...}`, `img{max-width:100%}`, `[hidden]...`). Motivo: o protótipo depende de `body{margin:0}` vindo dali; as regras de `body` seguintes sobrescrevem fonte/cores.

### JS do cliente — `public/js/app.js`
- Só o toggle do menu mobile (antecipado do M7 porque o header é deste marco e, sem ele, o botão fica morto em ≤ 1240 px): clique em `[data-act="menu"]` alterna `.open` em `#hdr`, atualiza `aria-expanded` e troca o ícone entre `menu` e `x` (paths copiados de `P`). Comportamento igual às linhas 1076 e 1081 do protótipo.
- Sem JS, a navegação continua possível pelos links do footer.

## Regras e mensagens
| Onde | Regra | Texto exato |
|---|---|---|
| 404 | rota inexistente | kicker "Ops" · título "Página não encontrada" · texto "Esse endereço não existe." · botão "Voltar ao início" (`/`) |
| 500 | erro não tratado | kicker "Ops" · título "Algo deu errado" · texto "Tivemos um problema ao carregar esta página. Tente de novo em instantes." · botão "Voltar ao início" (`/`) |
| `<title>` | home | "Pace Paulista" |
| `<title>` | 404 | "Página não encontrada · Pace Paulista" |
| `<title>` | 500 | "Erro · Pace Paulista" |
| Footer | slogan | "Encontre seu grupo.<br>Encontre seu ritmo." (igual ao protótipo) |
| Footer | aviso | "Os grupos marcados como “Fictício · demo” servem apenas para demonstrar a plataforma." (não contém "Nenhum dado é enviado a servidores") |
| Footer | versão | "v0.1 · São Paulo · {ano}" |
| `env.js` | `PORT` inválida | processo não sobe; mensagem cita `PORT` |

## Critérios de aceite
- [ ] CA1 — Dado `npm i` feito, quando rodo `npm run dev`, então o servidor sobe em `http://localhost:3000` e `GET /` responde 200 `text/html` com header e footer.
- [ ] CA2 — Quando abro `/` lado a lado com `docs/prototipo.html` (desktop e 360 px), então header e footer são visualmente idênticos (cores, fontes, marca, botões, espaçamentos, dark mode via `prefers-color-scheme`).
- [ ] CA3 — Dado `GET /`, então o link "Início" tem `aria-current="page"` e nenhum outro link de `[data-nav]` tem.
- [ ] CA3b — O footer mostra "Os grupos marcados como “Fictício · demo” servem apenas para demonstrar a plataforma." e não contém "Nenhum dado é enviado a servidores".
- [ ] CA4 — Nenhum `href="#..."` de rota do protótipo sobra no header/footer; todos usam as URLs reais da tabela de trocas.
- [ ] CA5 — `GET /css/app.css` responde 200 `text/css` e o conteúdo a partir do comentário do bloco principal é igual ao `<style>` das linhas 7–354 do protótipo.
- [ ] CA6 — `GET /qualquer-coisa` responde 404 com "Página não encontrada", "Esse endereço não existe." e link "Voltar ao início" para `/`, dentro do layout.
- [ ] CA7 — Um erro lançado (síncrono ou `async`) em uma rota responde 500 com a página 500 ("Algo deu errado", `<title>` "Erro · Pace Paulista") dentro do layout, sem stack nem mensagem do erro no HTML. A rota de erro usada no teste não existe na aplicação real.
- [ ] CA8 — `npm test` passa; `npm run lint` passa (ESLint sem erros e `prettier --check` limpo).
- [ ] CA9 — `.gitattributes` existe com `* text=auto eol=lf`; arquivos criados usam LF.
- [ ] CA10 — Funciona sem JS: com JS desligado, `/`, a 404 e a 500 renderizam completas e todos os destinos do header estão acessíveis pelo footer.
- [ ] CA11 — Com JS, em ≤ 1240 px o botão de menu abre/fecha a navegação, alterna `aria-expanded` e o ícone `menu`/`x`.
- [ ] CA12 — Responsivo em 360 px: sem scroll horizontal no header/footer/404.
- [ ] CA13 — Nenhum script inline no HTML gerado; nada de SQL no projeto (não há banco neste marco).
- [ ] CA14 — `npm start` sobe em modo produção (`NODE_ENV=production`) sem depender de devDependencies.

## Testes esperados
- unit (funções puras; manter a convenção `tests/domain/` — `tests/domain/view-helpers.test.js` e `tests/domain/env.test.js`):
  - `currentNav`: `/`→`inicio`; `/grupos`→`grupos`; `/grupos/pace-da-oca`→`grupos`; `/zonas`→`zonas`; `/sobre`→`sobre`; `/encontrar`→`''`; `/gruposx`→`''`.
  - `ic`: `ic('menu')` devolve `<svg class="ico " viewBox="0 0 24 24" aria-hidden="true">` + path do protótipo; `ic('pin','ico-sm')` contém `class="ico ico-sm"`; `ic('nao-existe')` lança erro.
  - `parseEnv`: defaults (`PORT` 3000, `NODE_ENV` development, `TZ_APP` America/Sao_Paulo); `PORT: '8080'` → 8080; `PORT: 'abc'` lança; `NODE_ENV: 'staging'` lança.
- http (supertest, `tests/http/scaffold.test.js`, usando `createApp()`):
  - `GET /` → 200, `content-type` html; contém `class="hdr"`, `PACE <b>PAULISTA</b>`, `href="/css/app.css"`, `class="ftr"`, `Encontre seu grupo.`, ano atual em `id="yr"`, o aviso novo do footer e não contém "Nenhum dado é enviado a servidores"; `data-nav="inicio"` com `aria-current="page"`; não contém `href="#`; não contém `<script>` sem `src`.
  - `GET /css/app.css` → 200, `text/css`, contém `--pista:#B3262E`.
  - `GET /js/app.js` → 200.
  - `GET /nao-existe` → 404, contém "Página não encontrada" e `href="/"`.
  - Erro: app de teste com uma rota que lança (sync) e outra `async` que rejeita → ambas 500, HTML da página 500, sem o texto da mensagem do erro. Mecanismo para registrar a rota de teste antes dos handlers de erro (ex.: `createApp({ beforeErrorHandlers })`) fica a critério do Coder, desde que não exponha rota em produção.

## Riscos / perguntas em aberto

### Perguntas em aberto
Resolvidas pelo usuário em 2026-11-11 (respostas já incorporadas em "Mudanças", "Regras e mensagens" e "Critérios de aceite"):
1. Texto do rodapé → "Os grupos marcados como “Fictício · demo” servem apenas para demonstrar a plataforma."
2. Página 500 → "Ops" / "Algo deu errado" / "Tivemos um problema ao carregar esta página. Tente de novo em instantes." / "Voltar ao início"; `<title>` "Erro · Pace Paulista".

### Riscos / decisões técnicas tomadas
- O diff passa de 400 linhas, mas ~350 são a cópia literal do CSS (mecânica e verificável por comparação). Por isso `app.css` fica fora do Prettier.
- Links do header/footer apontam para rotas que só existem a partir do M3/M5/M6 e respondem 404 até lá.
- `src/views/helpers.js` não está na árvore do `AGENTS.md` §3; é o "helper de view" previsto no §8 (alternativa a `partials/icons.ejs`, que não serve para ícones dentro de atributos/strings).
- Atributos `style="..."` (ex.: footer `.brand`, `--z` das zonas) continuam inline como no protótipo; a CSP do M8 precisará permitir estilos inline ou mover esses estilos para classes.
- Repo no Windows: após adicionar `.gitattributes`, arquivos já commitados podem precisar de `git add --renormalize .`.
