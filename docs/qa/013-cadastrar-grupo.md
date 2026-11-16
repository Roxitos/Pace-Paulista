# QA — 013 Cadastrar grupo
Veredito: APROVADO (2ª rodada; CA12 corrigido)

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 deslogado | ✅ | GET `/grupos/novo` → 302 `/conta/entrar?next=%2Fgrupos%2Fnovo`; POST sem `_csrf` → 403 |
| CA2 form logado | ✅ | 200, sem `aria-current` no menu |
| CA3 POST válido | ✅ | 303 `/grupos/<slug>?criado=1`; banco: owner_id=1, is_demo=f, published, days `{seg,qua}` (dedupe), `Combinado no grupo`, distance NULL, base_participants 1, tag "Novo na plataforma" |
| CA4 tela de sucesso | ✅ | dono vê "Grupo cadastrado" + 3 links; visitante e outro usuário veem o detalhe normal |
| CA5 aparece em busca/mapa/zonas | ✅ | `/grupos?zona=sul` contém o grupo; `/mapa/<slug>` e `/zonas` 200; "Cadastrado por você" (dono) / "Cadastrado por Pessoa a" (outro) |
| CA6 form vazio | ✅ | 422, "Corrija 11 campos para continuar.", 1 autofocus (9 `aria-invalid` = inputs de texto/select; radios e dias em fieldset) |
| CA7 reexibe valores | ✅ (testes do Coder; contador `#descCount` presente) | `npm test` |
| CA8 nome duplicado | ✅ | `correria DO carmo` → 422 "Já existe um grupo com esse nome." |
| CA9 slug | ✅ | testes unitários (não reverificado manualmente) |
| CA10 24:00 | ✅ | "Informe o horário do treino."; migrate 2x ok (006 aplicada, 2ª execução "em dia") |
| CA11 hostis | ✅ | nome repetido, dias=xyz, zona=marte, NUL → 422, sem 500; `<script>` no nome escapado (0 ocorrências de `<script>alert`) |
| CA12 sem JS / 360 px | ✅ | 2ª rodada (Playwright 360×800, JS desligado, nome de 50 "B"): PRG ok; scrollWidth 360 em modo sucesso, `/grupos?zona=sul`, `/grupos`, `/grupos/novo` (vazio e com 11 erros), `/`, `/mapa`, `/zonas`, `/encontrar`; detalhe e `/mapa/<slug>` 200 |
| CA13 testes/lint | ✅ | 785/785, lint ok |

Testes: 785 passaram / 0 falharam · Lint: ok

## Rodada 2
Coder só alterou CSS (`.card h3,.success{overflow-wrap:anywhere}`, `min-width:0`, fora do bloco literal) + 1 teste. Migrate 2x ok, regressão (home, `/grupos` com filtro, detalhe demo) 200. Único erro de console: 422 do POST inválido (esperado). Postgres local iniciado via `service postgresql start` (sem Docker). Grupo e usuário de teste desta rodada removidos (restam 2 grupos não demo de rodadas anteriores no banco local).

## Problemas encontrados (rodada 1, resolvidos)
1. (bloqueante, CA12) Nome de 50 chars sem espaço (ex.: 50 × "A", slug de 40 "a") causa scroll horizontal a 360 px (viewport 360×800, Playwright):
   - `/grupos/<slug>?criado=1` (modo sucesso): `scrollWidth` 656 > 360; `<b>` do nome vai a x=656, e `div.success`, `p` e `choice-row` passam de 360.
   - `/grupos?zona=sul` (card do grupo na busca): `scrollWidth` 721; o `<a>` do nome vai a x=721.
   - Reproduzir: logar, cadastrar nome `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` (zona sul), abrir as duas URLs a 360 px. `/grupos/novo`, detalhe do grupo e `/mapa/<slug>` não estouram; `/grupos?zona=leste` (sem o grupo) fica em 360.
   - Correção sugerida (Coder): `overflow-wrap: anywhere` (e `min-width: 0` nos flex/grid) no título do card e no `.success`. A pendência da spec já previa isso.
2. Nota (não bloqueante): o erro 404 visto no console numa primeira rodada não se repetiu nas páginas `/`, `/grupos/novo` e `/mapa/<slug>`; o 422 do console é o POST inválido esperado.

## Sugestões não bloqueantes
- Ambiente: `npm run db:up` falhou (sem Docker no sandbox); usei o Postgres local já ativo. `node_modules/playwright` é link quebrado; usei `/opt/node-tools`.
- Senha exige caractere especial (spec 010); útil lembrar nos testes manuais.
- Comparação visual com `docs/prototipo.html` só por leitura das telas/marcação, sem diff pixel a pixel.
