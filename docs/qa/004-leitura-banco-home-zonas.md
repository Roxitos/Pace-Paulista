# QA — 004 Leitura do banco: repo de grupos, home e /zonas
Veredito: APROVADO

Data: 2026-11-11 · Branch `claude/pipeline-m3-start-059610`, com o diff no working tree (nada commitado; HEAD `b9336f3`) · Windows 10, Node 22.23.4, Docker `postgres:16`, Chrome 157 headless via CDP.

## Ambiente
- `npm ci`: ok. `npm audit --omit=dev`: 0 vulnerabilidades. O `npm audit` completo mostra 4 moderadas, todas de desenvolvimento (`minimatch` via `eslint`), como nos QAs anteriores. Nenhuma dependência nova.
- `npm run db:up`: **não rodei a partir deste worktree**. O container `pace-paulista-agentes-db-1` (projeto compose do checkout principal) já estava saudável em `127.0.0.1:5432`. Um `docker compose up` daqui criaria outro projeto (`pipeline-m3-start-059610`) disputando a mesma porta. Usei o banco que já estava de pé.
- `npm run migrate` 2x: `Banco localhost:5432/pace_paulista já está em dia (5 migrations).` nas duas, código 0. `npm run seed`: `0 de 11 grupos demo inseridos (11 já existiam)`. Banco de dev: 11 grupos `published`/demo, 0 usuários, 0 memberships.
- Servidores: o diff na porta 3311 (banco de dev); uma cópia da HEAD (`git archive HEAD`) na 3312; o diff com `NODE_ENV=test` na 3313, para os cenários que alteram dados (banco de teste, truncado ao final; o `npm test` refaz o seed); o diff com `DATABASE_URL` na porta 1 na 3314 (banco fora do ar de verdade).
- Relatórios das etapas: usei o resumo do orquestrador (Coder, Cleaner e Hardener). Não há `docs/reports/004-*`.

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 — `/` idêntico ao de antes da spec, com migrate + seed | ✅ | `curl /` no diff (3311, lendo do banco) e na HEAD (3312, lendo `DEMO_GROUPS`): os dois deram 200 com 21551 bytes, e `cmp` não acusou diferença (**byte a byte idênticos**). `/x404` também é idêntico (404, 4708 bytes) |
| CA2 — nada em `src/` importa `db/seeds/` | ✅ | `grep -rn "db/seeds" src/` não devolve nada |
| CA3 — 1 membership no `pace-da-oca` → 57 | ✅ | Banco de teste com a usuária Ana e 1 membership: o card do Pace da Oca na `/` mostra só `<dd class="mono">57</dd>`. Testes `home.test.js` e `groups-repo.test.js` (57 e depois 58 com 2 memberships; Correria continua 48) |
| CA4 — `pelotao-paulista` `pending` | ✅ | Manual: Centro com `<span>1 grupo</span>` na home, 2 `<article class="card">`, e `/zonas` com Centro `<b>1</b>&nbsp;grupo` + só "Elevado Presidente João Goulart (Minhocão)". O teste confere `<strong>10</strong>grupos cadastrados` para `pending` e `rejected`, e `zonas.test.js` também |
| CA5 — sem demo: nem aviso nem etiqueta; dono "Ana"; sem dono nada | ✅ | Manual, com `is_demo=false` em todos e dono Ana na Correria: "Versão de demonstração" não aparece; há uma única `class="demo-tag"`, que é `<span class="demo-tag">Cadastrado por Ana</span>`; os outros 2 destaques ficam sem etiqueta. O texto "Fictício · demo" ainda aparece uma vez, no **rodapé** (`footer.ejs`, spec 001), e não como etiqueta. Ver a sugestão 1 |
| CA6 — contrato `Group` do repo | ✅ | `groups-repo.test.js`: chaves exatamente as 18 da tabela; `id`, `owner_id`, `email`, `password_hash`, `role`, `base_participants` e `status` ausentes (inclusive com dono admin de hash conhecido); `start_time` `^\d{2}:\d{2}$` (`06:30`); `participants`, `pace_*` são `number`; `map_pin` `[200,246]`; ordem igual à lista da spec. Lendo o SQL: colunas explícitas, `$1::text[]` = `ZONA_ORDEM`, `::int` na contagem, sem `setTypeParser` |
| CA7 — `GET /zonas` | ✅ | 200, `<title>Zonas · Pace Paulista</title>`, um único `aria-current="page"` (em `href="/zonas" data-nav="zonas"`), 5 `class="zrow"` na ordem Norte, Oeste, Centro, Leste, Sul, 5 `class="seal" width="120"`, contagens 2/2/2/2/3 e locais iguais aos da tabela da spec, CTAs `/grupos?zona={norte,oeste,centro,leste,sul}` |
| CA8 — sem grupos publicados | ✅ | Manual, com todos os grupos `rejected`: `/zonas` mostra 5× `<b>0</b>&nbsp;grupos` e 5× "Nenhum local ainda"; a home mostra `<strong>0</strong>grupos cadastrados`, sem faixa de pace e sem `Infinity`/`NaN`/`undefined` |
| CA9 — escape de nome, local e `owner_name` | ✅ | Manual: nome `<script>alert(1)</script>`, local `<img src=x onerror=alert(2)>` e dono `<script>alert(9)</script>`. Na `/` e na `/zonas` não há nenhum `<script>alert` ou `<img src=x` cru; aparecem só as formas `&lt;…&gt;`. Em `zonas.ejs` e `demo-tag.ejs`, `<%-` só aparece com `include`, `seal` e `ic` |
| CA10 — banco indisponível → 500 sem vazar | ✅ | Real, sem mock (`DATABASE_URL` na porta 1): `/` e `/zonas` → 500 com "Algo deu errado". O HTML não tem `ECONNREFUSED`, `localhost:1`, `postgres://` nem stack; o stack vai só para o log do servidor. `/x404` continua 404. O teste com `vi.mock` (`banco-indisponivel.test.js`) também passa |
| CA11 — sem JS e 360 px | ✅ | Chrome headless, 360×800, claro e escuro, com JS ligado e **desligado** (`Emulation.setScriptExecutionDisabled`): em `/` e `/zonas`, `scrollWidth` = `innerWidth` = 360, e `scrollTo(500,0)` mantém `scrollX = 0`. Sem JS a página sai completa do servidor; `grep 'href="#'` = 0 nas duas páginas, e o único script é `<script src="/js/app.js" defer>`. Screenshot `/zonas` 360 px conferido: cards empilhados, selo no topo, CTA visível |
| CA12 — SQL só no repo, parametrizado; testes e lint | ✅ | `grep -rnE "SELECT\|INSERT\|UPDATE\|DELETE\|BEGIN\|COMMIT\|ROLLBACK" src/` só encontra `groups.repo.js` (o SELECT) e `pool.js` (BEGIN/COMMIT/ROLLBACK). Só `groups.repo.js` importa `db/pool`. O único parâmetro é `$1`. Testes 249/0, lint ok |

Testes: 249 passaram / 0 falharam (20 arquivos, 42 s) · Lint: ok (ESLint sem erros; "All matched files use Prettier code style!")

## Fidelidade ao protótipo (`/zonas`)
- Abri `docs/prototipo.html#zonas` no mesmo Chrome e comparei com `/zonas` em 360×800 e 1280×800, claro e escuro. Para os 87 elementos de `.page-head` e `.zone-rows`, gerei uma assinatura com tag, classe, posição, tamanho, cor, fundo, fonte, tamanho e peso da fonte, padding, margin, raio, display, colunas do grid e texto das folhas. Resultado: **0 diferenças nos 4 cenários**. Anton, Inter e JetBrains Mono carregadas.
- Única diferença de conteúdo, já prevista em "Riscos" na spec: Oeste e Centro listam os locais na ordem do repo ("Cidade Universitária (USP) · Parque Villa-Lobos", "Elevado … (Minhocão) · Avenida Paulista"), e o protótipo lista na ordem inversa.
- O HTML de `zonas.ejs` bate com `PageZonas` (linhas 767–777). A única troca é `#grupos-<z>` → `/grupos?zona=<z>`.

## Console do navegador
- `/` e `/zonas`, nos 10 carregamentos (360 px e 1280 px, temas, JS ligado/desligado): nenhum `console.*` e nenhuma exceção. A única mensagem foi `Failed to load resource: 404` para `/favicon.ico`, no primeiro carregamento do perfil novo. O favicon não existe na HEAD nem no protótipo, então **não é regressão desta spec** (sugestão 2).

## Regressão
- Home byte a byte idêntica à HEAD (CA1). `/css/app.css` e `/js/app.js` 200.
- `/grupos`, `/grupos?zona=sul` e `/grupos/pace-da-oca` → 404, como na HEAD. Essas páginas entram nas specs 005 e 006, então a regressão de filtro e de detalhe ainda não se aplica.
- Unidade: `getHomeData` usa o `participants` recebido (caso 99), e `getZonesData` tem ordem, locais distintos, lista vazia e zonas desconhecidas (`marte`, `toString`, `__proto__`, `undefined`).
- README: mostra a nota de que `dev`/`start` precisam do Postgres e o subconjunto sem banco `tests/domain tests/scripts`, que bate com a mensagem de `ensureTestDb` e com o teste dela.

## Problemas encontrados
Nenhum bloqueante.

## Sugestões não bloqueantes
1. **CA5 ao pé da letra × rodapé**: o rodapé (spec 001) sempre diz "Os grupos marcados como “Fictício · demo” servem apenas para demonstrar a plataforma.", mesmo sem nenhum grupo demo. A etiqueta, que é o que o CA5 e o teste conferem, some corretamente. Fica para o Specifier/orquestrador decidir (registrar em `PENDENCIAS.md`) se o rodapé deve seguir o `hasDemo`, como o aviso da home.
2. `/favicon.ico` responde 404 e gera um "Failed to load resource" no console no primeiro carregamento. Vem da 001. Um `<link rel="icon">` ou um favicon estático resolveria.
3. A `/zonas` faz a mesma consulta completa (`listPublished`, com todas as colunas e o JOIN de memberships) só para contar e listar locais. Com 11 grupos isso não importa. Se o volume crescer (M9), vale uma consulta agregada própria.
4. `GROUP BY g.id, u.display_name` funciona porque `g.id` é PK. Se o join de `users` mudar, lembrar que `u.display_name` precisa continuar no `GROUP BY`.
5. Os headers de `/zonas` não trazem CSP/`helmet`. Isso é esperado, porque `helmet` ainda não entrou (marco de segurança). Registro só para não esquecer.

## Pendências para os próximos marcos
- **005/006**: o formato `Group` está fixo. `contact` e `map_pin` já saem do repo, mas nenhuma view usa ainda.
- **Ambiente de QA em worktree**: `npm run db:up` dentro de um worktree cria outro projeto compose na mesma porta 5432. Vale fixar `name: pace-paulista` no `docker-compose.yml` (decisão do Specifier) ou documentar que se usa o container do checkout principal.
