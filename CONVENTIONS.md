# Convenções — Pace Paulista

Vale para humanos e agentes. Em conflito, `AGENTS.md` define o produto e este arquivo define o estilo.

## Idioma
- **Código e banco em inglês**: variáveis, funções, arquivos, tabelas, colunas (`groups`, `pace_min_s`, `listPublished`).
- **Valores de domínio em pt-BR**, porque aparecem em URL e formulário: `norte`, `iniciante`, `seg`, `manha`.
- **UI, mensagens de erro, nomes de teste, commits e comentários em pt-BR.**

## Comentários
- Comente só o **porquê**: decisão, regra de negócio, armadilha. Nunca o "o quê" que o código já diz.
- Não comente cada função. JSDoc só em funções públicas de `src/domain/` cujo contrato não é óbvio (unidades, fuso).
- Bom: `// Calcula no fuso de SP: o servidor roda em UTC e "sábado 6h30" mudaria de dia.`
- Ruim: `// soma 1 ao contador`

## Estrutura e camadas
- `routes → service → repo`; `domain/` é puro (sem I/O, sem `req`/`res`, sem `Date.now()` escondido: receba `now` por parâmetro).
- SQL só em `*.repo.js`, parametrizado (`$1`). Um arquivo de repo por tabela principal.
- Um módulo = uma pasta em `src/modules/<nome>/` com `*.routes.js`, `*.service.js`, `*.repo.js`, `*.schemas.js`.
- Migrations numeradas e imutáveis depois de commitadas.

## JavaScript
- ES modules, `const` por padrão, `async/await` (sem `.then` encadeado).
- Funções pequenas; retorno antecipado em vez de `if` aninhado.
- Erros de domínio com classes próprias (`ValidationError`, `NotFoundError`, `ForbiddenError`) tratadas no `errorHandler`.
- Pace sempre em segundos (`*_s`) no código e no banco; formatar só na view.
- Datas: `TIMESTAMPTZ` no banco; conversão para `America/Sao_Paulo` só em `domain/schedule.js`.

## Views e front
- Dados sempre com `<%= %>`. `<%- %>` só para partials e SVGs internos.
- Reaproveitar classes do `public/css/app.css` (vindo do protótipo). CSS novo só se não existir equivalente, com tokens (`var(--…)`), nunca cor solta.
- JS do cliente é melhoria progressiva: tudo funciona sem ele. Sem script inline.

## Testes
- `vitest`. Unit em `tests/domain/`, HTTP com `supertest` em `tests/http/`.
- Nome descreve comportamento: `it('recusa pace acima de 12:00')`.
- Banco de teste separado (`DATABASE_URL_TEST`), limpo entre suítes com `TRUNCATE … RESTART IDENTITY CASCADE`.

## Git
- Branch por spec: `feat/NNN-slug`, `fix/…`, `chore/…`.
- Conventional Commits em pt-BR: `feat(grupos): filtro por faixa de pace`.
- Um PR por spec, com link para a spec e o relatório de QA.
