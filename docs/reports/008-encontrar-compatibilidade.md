# Relatório — 008 Encontrar meu grupo `/encontrar` com `calcMatch` no servidor
Marco: M4 · Spec: [`docs/specs/008-encontrar-compatibilidade.md`](../specs/008-encontrar-compatibilidade.md) · QA: [`docs/qa/008-encontrar-compatibilidade.md`](../qa/008-encontrar-compatibilidade.md)
Branch: `feat/m4-compatibilidade` (sem commit ainda) · Data: 2026-11-11 (spec) e 2026-11-12 (implementação)

## Linha do tempo
| Etapa | Resultado |
|---|---|
| Specifier | Spec única do M4 escrita; 5 perguntas (P1–P5) respondidas pelo usuário em 2026-11-11 (defaults); spec finalizada como "pronta para Coder" |
| Coder | Implementado; CA1–CA11 cobertos (CA3 âncora e CA10 360 px deixados para o QA); 630 testes (31 arquivos), lint ok |
| Cleaner | 4 limpezas pequenas (montagem de `q` no schema, testes); sem mudança de comportamento; 630 testes |
| Hardener | Nenhum defeito; +12 testes de regressão de borda (aspas no pace, `%` malformado, dígitos não ASCII, > 1000 pares); 642 testes, lint ok |
| QA (volta 1) | **REPROVADO** — 11/12 critérios ok (CA1 com 6.183.630 combinações e 0 divergências do protótipo); CA10 falha: 21 px de scroll horizontal a 360/375 px |
| Coder (volta 1) | `#matchForm .btn{white-space:normal;text-align:center}`: botão quebra em 2 linhas a 360 px; `scrollWidth` 360/375 nas 4 variantes; layout ≥ 768 px inalterado; 642 testes |
| QA (volta 1) | **APROVADO** — CA10 ok: `scrollWidth` 360/375/390 em 5 variantes, com e sem JS, claro e escuro; botão 266×76 em 2 linhas a 360 px; ≥ 768 px igual à volta 0; regressão byte a byte contra o HEAD nas outras páginas; 642 testes, lint ok |

Cleaner e Hardener não foram repetidos na volta 1: a correção é uma regra CSS de uma linha, restrita a `#matchForm`, sem lógica nem entrada de dados.

## Decisões de produto
- **P1** (default): `/encontrar` só por **GET**, respostas na query string (como `/grupos`). Não existe `POST /encontrar`; sem CSRF nem body-parser no M4. AGENTS §5 atualizado.
- **P2** (default): subtítulo vira "…Nada é salvo." (sai "nem enviado", que deixou de ser verdade).
- **P3** (default): empate desfeito pela ordem de criação (`ORDER BY g.id`, ordenação estável), reproduzindo o protótipo.
- **P4** (default): motivo "Fica na Centro" fica literal; entra no item P11 de `PENDENCIAS.md` junto com "Selo da Centro".
- **P5** (default): `inputmode="numeric"` no pace fica literal; item novo em `PENDENCIAS.md` (M7) para testar em iPhone real.
- **Desvio do protótipo (QA, volta 1)**: o botão "Mostrar grupos compatíveis" quebra em duas linhas a ≤ 375 px. O protótipo tem o mesmo estouro (381 px); a regra do AGENTS §8/§11.7 (360 px sem scroll) prevalece.

## Specifier
- Spec: domínio `src/domain/match.js` (`calcMatch`, `rankMatches`: pct ≥ 40, desc, máx. 6), módulo `src/modules/matching/` (schemas zod, service, routes), repo `listPublishedByCreation()`, view `pages/encontrar.ejs` e partials `match-card` e `form-errors`.
- Critério do marco: `tests/domain/match-prototipo.test.js` compara uma cópia literal do código do protótipo com `rankMatches` sobre uma grade determinística de respostas com os 11 grupos demo; casos A–J trabalhados na spec.
- Divergências do AGENTS §6 em relação ao protótipo (a spec segue o protótipo): 5 motivos em vez de 2; pace a até 60 s e nível vizinho pontuam sem motivo; "dentro da faixa" inclui as bordas; desempate não definido. AGENTS §6 ganhou um parágrafo com esses detalhes.
- Fora do escopo: o item "zod no cadastro de grupo" listado em M4 no `PENDENCIAS.md` é do cadastro (M6) e foi movido para lá; "Você já participa" e modal de participar ficam para M6/M7.

## Orquestrador
- `AGENTS.md`: §3 (arquivos de `matching/` e partial `match-card`), §5 (`/encontrar` via GET com query; linha `POST /encontrar` removida), §6 (detalhes do `calcMatch` vindos do protótipo).
- `docs/PENDENCIAS.md`: P1–P5 registradas como resolvidas; "Fica na Centro" no item P11; item de cadastro movido de M4 para M6; teste do `inputmode` em aparelho real no M7; nota no M8 de que `/encontrar` deixa de ser link 404. Ao fim do ciclo: M4 concluído e pendências do Hardener/QA da 008 (ver abaixo).
- Ambiente desta sessão: sem Docker; Postgres 16 local (`pace`/`pace`) no lugar do `npm run db:up`.

## Coder
**Novos**
- `src/domain/match.js`: `calcMatch`, `rankMatches`, `MATCH_MIN_PCT`, `MATCH_LIMIT`; funções puras; zona ou nível desconhecido lança `RangeError`.
- `src/modules/matching/matching.schemas.js`: `MATCH_FIELDS`, `hasMatchParams`, `parseMatchForm` — normaliza a entrada (`Object.hasOwn`, primeiro valor de array, não-string = ausente) e valida com zod; erros na ordem zona, pace, dias, nível.
- `src/modules/matching/matching.service.js`: `findMatches(q)`.
- `src/modules/matching/matching.routes.js`: só `GET /encontrar` — 200 com form vazio e 422 com erros **sem tocar no banco**; 200 com resultados quando válido.
- `src/views/pages/encontrar.ejs` (reproduz `PageEncontrar`/`submitMatch`, com `autofocus` e `aria-invalid`), `src/views/partials/match-card.ejs` (links reais), `src/views/partials/form-errors.ejs` ("Corrija N campo(s) para continuar.").
- Testes: `tests/domain/match.test.js` (35), `tests/domain/match-prototipo.test.js` (cópia literal do protótipo × `rankMatches` + casos A–J), `tests/domain/matching-schemas.test.js` (29), `tests/http/encontrar.test.js` (29).

**Alterados**
- `src/modules/groups/groups.repo.js`: `listPublishedByCreation()` (`selectPublished` + `ORDER BY g.id`); `groups.service.js`: `listGroupsForMatching()`.
- `src/app.js`: `DIAS_CURTO` em `app.locals`; `app.use(matchingRouter)` depois de `groupsRouter`.
- `public/css/app.css`: `#matchResults{scroll-margin-top:84px}` e `.match h3{overflow-wrap:anywhere}` no bloco de acréscimos.
- `tests/db/groups-repo.test.js` (+3 testes) e `tests/http/banco-indisponivel.test.js` (mock + `/encontrar` com banco fora: 200/422 sem consulta, 500 genérico na busca).

**Observações**
- Grade do CA1 reduzida a subconjuntos de dias de tamanho 1, 2 e 7 (127 subconjuntos levavam ~10 s), como a spec permite; bordas de pace mantidas. O QA rodou a grade completa à parte.
- Trechos copiados do protótipo têm `// prettier-ignore` para ficarem literais; de `ZONAS` só vem `nome`.
- Sem erro, `aria-invalid` não aparece (o JS do protótipo punha `"false"`).
- Com erro de validação a resposta é 422 mesmo com o banco fora (não consulta). `?utm_source=x` → form vazio 200.
- `currentNav('/encontrar')` → `''`: nenhum item do menu com `aria-current` (teste existente já esperava isso).

## Cleaner
- `matching.schemas.js`: `q = { ...values, pace: parsePace(values.pace) }` em vez de campo a campo.
- `match.test.js`: resultado guardado em `const r` em vez de chamar `match()` duas vezes; grupo/respostas nomeados (`avancado`, `q`) e campo redundante removido.
- `matching-schemas.test.js`: título do teste de nível inválido descreve os 3 valores testados.
- `banco-indisponivel.test.js`: `it.each([[path, status], ...])` no lugar de `if` no corpo do teste.
- Mantidos de propósito: cópia literal do protótipo e textos das views; `ORDER BY g.id` (P3); `listGroupsForMatching` (o módulo matching não chama o repo de groups direto); `zonaNome(q.zona)` com resultado descartado (lança `RangeError` em zona inválida, coberto por teste); `MSG` duplicado entre teste unitário e HTTP (no HTML as aspas vêm escapadas).

## Hardener
| Problema | Severidade | Correção | Teste |
|---|---|---|---|
| Nenhum defeito. Faltava cobrir pace com aspas fechando o `value` | — (escapado como `&#34;`) | — | `encontrar.test.js`: "pace com aspas não fecha o atributo value" |
| Faltava cobrir `%E0%A4%A`, `%`, `%00`, dígito fullwidth, `0012:00` no pace | — (422 de formato, nunca 500) | — | `encontrar.test.js`: `it.each` "pace=%s … → 422 de formato" |
| Faltava cobrir > 1000 pares na query | — (abaixo de 500) | — | `encontrar.test.js`: "enxurrada de parâmetros … não vira 500" |
| Faltava cobrir `５`, `٦`, negativo, `6:00:00` | — (`\d` sem flag `u` só aceita ASCII) | — | `matching-schemas.test.js`: lista "pace %j → erro de formato" |

Conferidos sem mudança: só o `pace` é ecoado, sempre por `<%= %>`; zona/dias/nível/período só aceitam valores da lista; links com `encodeURIComponent(slug)`; parser `simple` do Express 5 (`pace[a]=1` não vira objeto; `__proto__`/`constructor` → erro ou `''`); pace de 8 KB ecoado escapado, Node responde 431 acima de ~16 KB; `/encontrar/` e `/ENCONTRAR` ok, `/encontrar%2f` 404, HEAD 200, `POST` 404; `contact` e `owner_name` não chegam ao HTML (P4); `listPublishedByCreation` sem entrada do usuário e sem `pending`/`rejected`; cópia em `match-prototipo.test.js` bate caractere a caractere com `docs/prototipo.html` (linhas 859–868 e 879). CSRF/sessão/rate limit fora do M4 (rota GET só leitura).

Riscos aceitos e pendências geradas: ver [`docs/PENDENCIAS.md`](../PENDENCIAS.md).

## QA
Veredito em [`docs/qa/008-encontrar-compatibilidade.md`](../qa/008-encontrar-compatibilidade.md): **APROVADO** na volta 1.

**Volta 0 — REPROVADO (só CA10)**
- CA1 (pronto do M4): `calcMatch` e `DEMO` extraídos do `prototipo.html` no Chromium (independente da cópia do Coder) × `rankMatches` sobre os grupos do banco, grade completa (6 zonas × 127 subconjuntos de dias × 3 níveis × 5 períodos × todo pace de 180 a 720 s = 6.183.630 combinações): **0 divergências**. Casos A–J: `innerText` de `#matchResults` sem JS idêntico ao do protótipo. 400 respostas aleatórias via HTTP: 0 divergências.
- CA2–CA9, CA3b, CA11 ok: âncora para em y=84 sem JS; foco no 1º campo com erro; nenhum 500 com entradas fora do form; grupo `pending` fora; empate novo depois do demo; `<script>` escapado.
- Comparação com o protótipo (caso A, 360/1280, claro/escuro): 5 de 363 elementos diferem — os "Entrar no grupo" são `<a>` aqui e `<button>` lá, como a spec manda.
- **CA10 falhou**: 21 px de scroll horizontal a 360 e 375 px (botão `.btn` nowrap de 334 px numa coluna de 268 px; o protótipo tem o mesmo defeito). Devolvido ao Coder.

**Volta 1 — APROVADO**
- Só `public/css/app.css` mudou (`#matchForm .btn{white-space:normal;text-align:center}`); CA1–CA9 não refeitos.
- CA10: `scrollWidth` = largura a 360/375/390 px nas 5 variantes (form vazio, 2 de erro, resultados, sem resultados), com e sem JS, claro e escuro; nenhum filho do form passa da borda; envio real sem JS a 360 px abre `#matchResults` sem scroll.
- Regressão: working tree × HEAD no mesmo banco, md5 do corpo e cabeçalhos iguais em `/`, `/grupos` (+3 filtros), `/zonas`, `/sobre`, `/mapa`, `/mapa/pace-da-oca`, detalhes, 301 e 404s.
- 642 testes (31 arquivos), lint ok.

Sugestões não bloqueantes (registradas em `PENDENCIAS.md`): 320 px com 3 px de scroll em todas as páginas pelo `button.menu-btn` (já existia); rótulo mais curto no botão em telas estreitas (produto); nome longo sem espaço no `group-card` da `/grupos` (já no M6); piscada da fonte de fallback no 1º carregamento desloca a âncora por um instante.
