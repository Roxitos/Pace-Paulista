# QA — 002 Home estática igual ao protótipo
Veredito: APROVADO

Data: 2026-11-11 · Branch `feat/002-home-estatica` (nada commitado) · Windows 10, Node 22.

## Ambiente
- `npm ci`: ok. O `npm audit` continua apontando só dependências de desenvolvimento, como na 001.
- `db:up` / `migrate` / `seed`: **pulados**. Esses scripts não existem neste marco (o banco entra no M2) e o Docker não roda nesta máquina.
- O app subiu com `NODE_ENV=production PORT=3223 node src/server.js`. Também testei `PORT=3226 npm run dev`: log "Pace Paulista em http://localhost:3226", `/` 200 e o hero com 11 grupos.
- Verificação visual no navegador embutido. Servi uma cópia de `docs/prototipo.html` como estático em `localhost:3225`, a partir do scratchpad, sem alterar `docs/`. Para cada um dos 323 elementos dentro de `<main>`, nas duas páginas, gerei uma assinatura com caminho, classes, posição relativa, tamanho, texto e 23 propriedades calculadas: cor, fundo, fonte, tamanho, peso, espaçamento entre letras, altura de linha, padding, margin, bordas, raio, display, position, sombra, `animation-name`, `text-transform`, gap, colunas do grid, opacidade, stroke e fill. Depois comparei as assinaturas uma a uma. As animações de entrada (`rise`) foram finalizadas antes da medição: numa aba em segundo plano a animação fica parada no começo e o card aparece 6 px abaixo, o que dava diferença falsa.

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 — visualmente igual ao protótipo (desktop, 360 px, claro e escuro) | ✅ | Nos 4 cenários (1280×800 e 360×800, claro e escuro), as 323 assinaturas são idênticas às do protótipo, com duas exceções esperadas. **(a)** A 1ª estatística do hero é 8 px mais estreita (140 px contra 148 px), porque "grupos cadastrados" é mais curto que "grupos no protótipo", e as estatísticas seguintes se deslocam 8 px. **(b)** O botão "Entrar no grupo" agora é `<a>`, como a spec pede. Fora a tag, o estilo é idêntico (verde `#5E9A22`, Anton 16 px, padding 13×18, raio 8, 326×46). O `innerHTML` do `.hero-art` é idêntico ao do protótipo (mesmo hash, 2645 chars), assim como zcards, `.lanes` e `.cta-band`, descontada a troca de hrefs. A animação `dash` (2.4s, infinita) do `route-dash` está rodando: o `stroke-dashoffset` mudou de -6.4 para -19.6 em 0,7 s. O marcador amarelo `#E8B923` está presente. Fontes Anton e Inter foram carregadas |
| CA2 — números do hero e das zonas | ✅ | `curl /`: `<strong>11</strong>grupos cadastrados`, `<strong>5</strong>zonas da cidade`, `<strong>4:00–8:30</strong>min/km de pace` (en dash). Zonas: `2 grupos` ×4 e `3 grupos` (Sul). `grep -c 'grupos no protótipo'` = 0 |
| CA2b — "Sem cadastro para começar." | ✅ | Presente na raia 1, com o texto literal do protótipo |
| CA3 — destaques na ordem certa, com etiqueta e fatos | ✅ | Ordem dos `<h3>`: Correria do Carmo → Pace da Oca → Pelotão Paulista. Os 3 cards têm `Fictício · demo`. Fatos: `Sáb · 6h30`/`5:30–6:30 min/km`/`48`; `Seg, Qua, Sex · 6h`/`4:15–5:00 min/km`/`56`; `Dom · 7h`/`4:45–5:45 min/km`/`72` |
| CA4 — links reais, nenhum `href="#` | ✅ | `grep -c 'href="#'` = 0. Zcards → `/grupos?zona={norte,oeste,centro,leste,sul}`. Cada card → `/grupos/<slug>` (título e "Ver detalhes"), `/mapa/<slug>` e `/conta/entrar?next=/grupos/<slug>%23participar`. Seções → `/grupos`, `/encontrar`, `/zonas`, `/grupos/novo` |
| CA5 — `aria-label` dos 5 selos | ✅ | "Selo da Zona Norte, inspirado em Serra da Cantareira" … "Selo da Zona Sul, inspirado em Oca do Ibirapuera". A saída de `seal(z)` é idêntica à função `seal` do protótipo nas 5 zonas, e o `SEAL` é igual (comparação feita em script) |
| CA6 — escape | ✅ | Em `home.ejs` e nos partials, `<%-` só aparece com `ic(`, `seal(` e `include(`. Renderizei `group-card` com nome `<script>…`, descrição `<img onerror>`, local `"><b>` e slug `a"b<x>`: tudo saiu escapado, e os hrefs saíram codificados (`/grupos/a%22b%3Cx%3E`) |
| CA7 — funciona sem JS | ✅ | O HTML do servidor (curl, sem JS) traz a home completa. O único `<button>` da página é o do menu mobile (`data-act="menu"`, da 001). Nenhum `data-act="entrar"`. Único script: `<script src="/js/app.js" defer>`, sem script inline |
| CA8 — 360 px sem scroll horizontal | ✅ | `scrollWidth` = `innerWidth` = 360, claro e escuro, e `scrollTo(500,0)` mantém `scrollX = 0`. O `.zone-strip` rola dentro de si mesmo (`overflow-x:auto`, 1196 px de conteúdo em 360 px), igual ao protótipo. `.grid-cards` = 1 coluna de 320 px. As estatísticas do hero quebram em 2 linhas, igual ao protótipo |
| CA9 — `DEMO_GROUPS` igual ao `DEMO` | ✅ | Script avaliou o `DEMO` do protótipo e comparou campo a campo, pelo mapeamento da spec: 11 grupos na mesma ordem, **0 diferenças**, todos com `is_demo: true` e sem chaves extras. `ZONAS`, `NIVEIS` e `DESTAQUES` são idênticos ao protótipo |
| CA10 — sem SQL, domain sem I/O, testes e lint | ✅ | Nenhum `*.repo.js`. Busca por `pg`/`SELECT`/`INSERT` em `src/` e `db/` só encontrou um comentário em `schedule.js`. `src/domain/` não importa fs/http/pg/net nem usa `process`. Testes: 143/0. Lint ok |

Testes: 143 passaram / 0 falharam (9 arquivos) · Lint: ok (ESLint sem erros; Prettier: "All matched files use Prettier code style!")

## Regressão (001)
- Header e footer em 1280×800 claro: as assinaturas são idênticas às do protótipo (27 elementos no header, altura 71 px; 37 no footer, comparados sem a coordenada Y). `aria-current="page"` só em "Início".
- `git diff HEAD` em `layout.ejs`, `header.ejs`, `footer.ejs`, `404.ejs`, `500.ejs`, `public/` e `src/middlewares/`: nenhuma mudança.
- `/qualquer-coisa` → 404, com `<title>Página não encontrada · Pace Paulista</title>`, "Esse endereço não existe.", o botão "Voltar ao início", header e footer, e nenhum `aria-current`. `POST /` → 404. `x-powered-by` ausente.
- Destinos dos links (`/grupos`, `/conta/entrar`) respondem 404, como a spec prevê até os próximos marcos. `/css/app.css` e `/js/app.js` respondem 200.
- Console do navegador: nenhuma mensagem. Rede: `/`, `app.css` e `app.js` 200, sem falhas.
- Regressão de `/grupos` com filtro e do detalhe de grupo: não se aplica (M3).

## Problemas encontrados
Nenhum bloqueante.

## Sugestões não bloqueantes
1. O selo do Centro tem `aria-label="Selo da Centro, inspirado em Avenida Paulista"`. O "da Centro" vem literal do protótipo e a spec pede o mesmo HTML. Vale corrigir a concordância ("do Centro") numa spec futura, se o produto quiser.
2. Em 360 px a faixa de pace dos cards ("4:15–5:00 min/km") quebra em 2 linhas. É igual ao protótipo, então não é regressão.
3. Os links "Entrar no grupo", "Ver detalhes", "Ver rota", zonas e CTA levam a 404 até M3/M5. A spec aceita isso, mas convém não publicar o M1 isolado.
