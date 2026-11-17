# QA — 016 Filtros ao vivo na /grupos
Veredito: APROVADO

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 | ✅ | curl `/api/grupos?zona=sul&nivel=iniciante`: 200 JSON, 5 chaves, `1 grupo encontrado`, query `zona=sul&nivel=iniciante` |
| CA2 | ✅ | testes `tests/http/api-grupos.test.js` (verdes) |
| CA3 | ✅ | testes de API (visitante e logado) |
| CA4 | ✅ | `Cache-Control: private, no-store`; `?zona=marte&pace=xyz&nome=%00` → 200 |
| CA5 | ✅ | `?nome=&dia=sab&zona=sul&local=` → `zona=sul&dia=sab`; Playwright: URL `/grupos?zona=sul` após filtrar |
| CA6 | ✅ | `/grupos` tem `app.js` + `filtros.js` (módulos); `/` só `app.js`; sem script inline; `/js/ui.js` e `filtros.js` servem JS |
| CA7 | ✅ | Playwright 360x800: "Aplicar" oculto; zona/select mostram skeleton (3) e atualizam contagem/chips/cards/URL; "Nome" só busca 222 ms depois; Enter não recarrega |
| CA8 | ✅ | chip remove só o seu filtro (form + resultados), sem toast, foco em `#count`; Limpar (título e `.empty`) zera tudo, toast correto, some em ~3,2 s |
| CA9 | ✅ | botão `<button aria-expanded>` alterna `Filtros`/`Ocultar filtros`; sem scroll horizontal |
| CA10 | ✅ | `/api/grupos` com 500 e com abort → navegação normal para `/grupos?...` |
| CA11 | ✅ | JS desligado: botão "Aplicar filtros" visível, `a.filters-toggle`, chips como links, submit funciona (302 não, GET normal); menu mobile com JS ok (`aria-expanded=true`) |
| CA12 | ✅ | `npm test` e lint ok |
| Extra Hardener | ✅ | Ctrl+clique em chip abre nova aba (`/grupos?nivel=iniciante`) e a aba original não muda |

Testes: 816 passaram / 0 falharam (51 arquivos) · Lint: ok (eslint + prettier)
Ambiente: `npm ci`, migrate (duas vezes, idempotente), seed ok. `npm run db:up` falhou (sem Docker no sandbox); o Postgres local já estava de pé.
Rotas protegidas `/meus` e `/grupos/novo` redirecionam para `/conta/entrar?next=...`. Regressão: `/`, `/grupos` (filtro), `/grupos/pace-da-oca`, `/zonas`, `/mapa`, `/encontrar`, `/sobre`, `/conta/entrar` respondem 200.
Console do navegador: sem erros, exceto os esperados dos testes de falha induzida (500/abort).

Problemas encontrados: nenhum.

Sugestões não bloqueantes
- Sem JS a URL traz campos vazios (`nome=&local=...`), pendência já registrada.
- O `change` ao sair de "Nome" repete a busca (já registrado pelo Hardener).
- Não comparei visualmente com `docs/prototipo.html` por screenshot; textos e HTML seguem a spec.
