# QA — 001 Scaffold base: Express 5 + EJS, layout, header/footer, CSS, 404/500 e ferramentas
Veredito: APROVADO

Data: 2026-11-11 · Branch `feat/001-scaffold-base` (nada commitado) · Windows 10, Node 22.

## Ambiente
- `npm ci`: ok. O `npm audit` aponta só dependências de desenvolvimento (eslint 10/minimatch), risco já aceito pelo Hardener.
- `db:up` / `migrate` / `seed`: **pulados**. Não existem neste marco (banco é M2) e o Docker ainda não roda nesta máquina.
- O servidor subiu com `NODE_ENV=production PORT=3123 npm start`. Também testei `npm run dev` (porta padrão 3000) e uma cópia com `npm ci --omit=dev` (porta 3124).
- Verificação visual feita no navegador embutido, comparando o app com o protótipo. Como a visualização de arquivo local fica sempre em tema claro e sem fontes, o protótipo foi servido como HTML estático em `localhost:3125` (cópia no scratchpad). Para cada elemento do header e do footer (26 seletores), comparei uma assinatura com tamanho, posição relativa, cores, fonte, tamanho, peso, espaçamento entre letras, padding, margin, borda, raio, position e sombra.

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 — `npm run dev` sobe em :3000, `/` 200 html com header/footer | ✅ | `npm run dev` → log "Pace Paulista em http://localhost:3000"; `curl /` → `200 text/html; charset=utf-8`; HTML com `class="hdr"` e `class="ftr"` |
| CA2 — header/footer visualmente idênticos ao protótipo (desktop, 360 px, dark) | ✅ | Em 1280×800 claro e escuro, as assinaturas dos 26 elementos são **idênticas** às do protótipo. Em 360×800, as 17 do header são idênticas com o menu fechado e aberto. No footer, marca e slogan são idênticos; `.ftr .small` é mais baixo (40 px contra 81 px) porque o texto novo pedido pela spec é mais curto, e por isso os blocos abaixo descem menos. Sem a coordenada Y, `h4`, `ul`, links, `.mono` e as colunas são idênticos. Fontes carregadas (`document.fonts.check` ok para Anton e Inter) |
| CA3 — só "Início" com `aria-current="page"` em `/` | ✅ | `grep aria-current` → só `<a href="/" data-nav="inicio" aria-current="page">`. Na 404, 0 ocorrências (nav `''`) |
| CA3b — aviso novo no footer, sem "Nenhum dado é enviado a servidores" | ✅ | Texto exato presente; `grep -c 'Nenhum dado'` = 0 |
| CA4 — nenhum `href="#` | ✅ | `grep -c 'href="#'` = 0. Hrefs: `/`, `/grupos`, `/zonas`, `/sobre`, `/encontrar`, `/grupos/novo`, `/meus`, `/mapa` (conforme a tabela de trocas) |
| CA5 — `/css/app.css` 200 `text/css`, igual ao protótipo | ✅ | `200 text/css; charset=utf-8`. `tail -n +4 app.css` comparado byte a byte com `sed -n '7,354p' prototipo.html`: **idêntico**. A linha 2 (base do invólucro) é idêntica ao `<style>` da linha 1. O CSS servido é igual ao arquivo |
| CA6 — 404 em rota inexistente, dentro do layout | ✅ | `/qualquer-coisa` → 404, `<title>Página não encontrada · Pace Paulista</title>`, kicker "Ops", "Página não encontrada", "Esse endereço não existe.", `<a class="btn btn-primary" href="/">Voltar ao início</a>`, header e footer presentes. `POST /` e `DELETE /x` → 404 |
| CA7 — erro sync/async → 500 sem stack nem mensagem | ✅ | Testes em `tests/http/scaffold.test.js` (sync, async, falha de render → `Erro interno.` em texto puro, 4xx e status inválido). Não existe rota de erro exposta em produção (`beforeErrorHandlers` só nos testes) |
| CA8 — `npm test` e `npm run lint` | ✅ | 39 passaram / 0 falharam (3 arquivos). ESLint sem erros; Prettier: "All matched files use Prettier code style!" |
| CA9 — `.gitattributes` e LF | ✅ | Conteúdo `* text=auto eol=lf`; nenhum CR em src/public/tests/configs; `git check-attr eol` → lf |
| CA10 — funciona sem JS | ✅ | HTML do servidor (curl, sem JS) traz header, footer, ano em `#yr`, ícones `user` e `menu` já renderizados, e a 404 completa. O footer cobre todos os destinos do header (`/`, `/grupos`, `/zonas`, `/sobre`, `/encontrar`, `/grupos/novo`, `/meus`, mais `/mapa`). A 500 sai do servidor sem JS (testes) |
| CA11 — menu mobile abre/fecha, `aria-expanded`, ícone | ✅ | Em 360 px: estado inicial `aria-expanded=false`, ícone `menu`. No 1º clique, `#hdr.open`, `#nav` `display:flex`, `aria-expanded=true`, ícone `x` (`M18 6l-12 12M6 6l12 12`). No 2º clique, volta ao estado inicial. Com o menu aberto, o header tem as mesmas assinaturas do protótipo aberto |
| CA12 — 360 px sem scroll horizontal | ✅ | `scrollWidth <= innerWidth` (360 = 360) em `/` claro, em `/` com menu aberto e na 404 escura. O `svg.lanes-deco` passa da borda, mas é cortado (igual ao protótipo) e não gera scroll |
| CA13 — sem script inline; sem SQL | ✅ | Único `<script>` é `<script src="/js/app.js" defer>`; `grep` por `pg`/`SELECT`/`INSERT` em `src/` não encontrou nada |
| CA14 — `npm start` em produção sem devDependencies | ✅ | Cópia com `npm ci --omit=dev` (nenhum pacote de dev instalado) e `NODE_ENV=production node src/server.js` → `/` 200, `/x` 404 |

Testes: 39 passaram / 0 falharam · Lint: ok

## Checagens extras
- `x-powered-by` ausente em `/` e na 404.
- `PORT=abc` → processo não sobe (exit 1) com "Variáveis de ambiente inválidas: PORT". O mesmo vale para `NODE_ENV=staging` e `TZ_APP=Foo/Bar`.
- `/css/../../package.json` e `/%E0` → 404 (sem vazamento de arquivos nem 500).
- Console do navegador: nenhuma mensagem em `/` (claro/escuro, 1280 e 360) nem na 404. Rede: `app.css` e `app.js` 200/304, sem requisições falhando.
- Regressão (`/grupos` com filtro, detalhe de grupo): não se aplica neste marco. Essas rotas respondem 404, como a spec prevê.

## Problemas encontrados
Nenhum bloqueante.

## Sugestões não bloqueantes
1. `.prettierignore` tem duas entradas além das que a spec lista (`*.md` e `.claude/`). São inofensivas e coerentes com a intenção, mas vale registrar na spec ou no PR.
2. Erros 4xx diferentes de 404 (ex.: 400, 413) mostram a página "Algo deu errado" com o status 4xx preservado. Foi decisão do Hardener e a spec não define isso. Quando os formulários entrarem (M5/M6), revisar se 4xx deve ter um texto próprio.
3. Com a home vazia, o footer fica logo abaixo do header. Isso é esperado até a spec 002.
4. Sem favicon (o protótipo também não tem). Não gerou erro no console.
