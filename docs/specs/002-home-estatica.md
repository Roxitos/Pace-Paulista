# 002 — Home estática igual ao protótipo
Marco: M1 · Status: pronta para Coder
Depende de: 001-scaffold-base

## Objetivo
Preencher `/` com a home do protótipo (`PageHome`, linhas 592–652 de `docs/prototipo.html`): hero com estatísticas e arte da pista, aviso de demonstração, faixa das 5 zonas, 3 grupos em destaque, "Como funciona" e CTA de cadastro. Sem banco: os dados vêm de um módulo estático com os 11 grupos demo, que o M2 reutiliza no seed.

## Fora do escopo
- Banco/consultas (M2/M3). Nesta spec nenhum arquivo `*.repo.js` é criado.
- Estado "Você participa" / badge de participações / "Cadastrado por …" (M5/M6). Todos os grupos aqui são demo.
- Modal "Entrar no grupo" (M7). Aqui o botão é um link comum (fluxo de visitante deslogado).
- `PERIODOS`, `PACE_FAIXAS`, `periodoDe`, `proximos`, `calcMatch`, `slug` (M3/M4/M6) — não são usados na home.
- Páginas de destino dos links (`/grupos`, `/grupos/:slug`, `/mapa/:slug`, `/encontrar`, `/grupos/novo`, `/conta/entrar`): continuam 404 até seus marcos.

## Mudanças

### Banco
Nenhuma.

### Dados demo — `db/seeds/demo-groups.js` (novo, só dados, sem I/O)
- Exporta `DEMO_GROUPS`: array com os 11 grupos do `DEMO` do protótipo (linhas 476–510), **copiados literalmente** e convertidos para os nomes de coluna do `AGENTS.md` §4:
  | protótipo | aqui |
  |---|---|
  | `id` | `slug` |
  | `nome` | `name` |
  | `zona` | `zone` |
  | `local` | `location` |
  | `ponto` | `meeting_point` |
  | `dias` | `days` |
  | `horario` (`'06:30'`) | `start_time` (`'06:30'`) |
  | `paceMin` / `paceMax` | `pace_min_s` / `pace_max_s` |
  | `distancia` | `distance` |
  | `nivel` | `level` |
  | `participantes` | `base_participants` |
  | `descricao` | `description` |
  | `perfil` | `profile_tags` |
  | `pin` | `map_pin` |
  | — | `is_demo: true` |
- Ordem do array igual à do protótipo. O M2 (`scripts/seed.js`) deve importar este mesmo arquivo.

### Domínio (funções puras, `src/domain/`)
- `constants.js`: `ZONAS` (com `nome`, `curto`, `cor`, `on`, `marco`, `desc` **copiados literalmente** das linhas 415–426), `ZONA_ORDEM`, `DIAS`, `DIAS_CURTO`, `DIA_ORDEM`, `NIVEIS`, `DESTAQUES = ['correria-do-carmo','pace-da-oca','pelotao-paulista']`.
- `pace.js`:
  - `fmtPace(s: number): string` → `"m:ss"` (ex.: 330 → `"5:30"`).
  - `fmtFaixa(minS: number, maxS: number): string` → `"5:30–6:30 min/km"` (traço **en dash** `–`, como no protótipo).
  - `parsePace(str: string): number | null` → igual à linha 540 do protótipo (trim; regex `^\d{1,2}:[0-5]\d$`; fora de 180–720 → `null`).
- `schedule.js` (só formatação nesta spec):
  - `fmtHora('HH:MM'): string` → igual à linha 541 (`'06:30'`→`'6h30'`, `'07:00'`→`'7h'`).
  - `sortDias(days: string[]): string[]` → ordena por `DIA_ORDEM`, sem mutar a entrada.
  - `fmtDiasCurto(days): string` → `sortDias` + `DIAS_CURTO` unidos por `", "`.

### Serviço — `src/modules/pages/pages.service.js` (novo)
- `getHomeData(groups = DEMO_GROUPS)` → objeto:
  ```
  {
    totalGroups,          // groups.length
    paceMinS, paceMaxS,   // menor pace_min_s e maior pace_max_s de todos
    countsByZone,         // { norte, oeste, centro, leste, sul } (zonas sem grupo = 0)
    featured,             // grupos de DESTAQUES, nessa ordem; slug ausente é ignorado
    hasDemo               // algum grupo com is_demo
  }
  ```
  Cada grupo em `featured` ganha `participants = base_participants` (no M3 virá `base_participants + COUNT(memberships)` da query; a view usa sempre `participants`).
- Função pura em relação ao argumento (o M3 troca a fonte por `groups.repo`, sem mudar a view).

### Rotas
| Método | Caminho | Auth | Resultado |
|---|---|---|---|
| GET | `/` | — | 200, `renderPage('home', { title: 'Pace Paulista', ...getHomeData() })` |

### Helpers de view — acrescentar em `src/views/helpers.js` (expostos em `app.locals`)
- `SEAL` copiado literalmente (linhas 466–472) e `seal(zone, size = 64)` com o mesmo HTML da linha 473 (inclui `role="img"` e `aria-label="Selo da {nome}, inspirado em {marco}"`).
- `zstyle(zone)` → `"--z:{cor};--zon:{on}"`.
- Expor também `ZONAS`, `ZONA_ORDEM`, `NIVEIS`, `fmtPace`, `fmtFaixa`, `fmtHora`, `fmtDiasCurto` para os templates.

### Partials (mesmo HTML dos componentes do protótipo)
- `partials/zone-chip.ejs` ← `ZoneChip` (linha 561).
- `partials/level-meter.ejs` ← `LevelMeter` (linha 559).
- `partials/demo-tag.ejs` ← ramo demo de `DemoTag` (linha 560): `<span class="demo-tag" title="Grupo fictício para demonstração">Fictício · demo</span>`. Só o ramo demo nesta spec.
- `partials/group-card.ejs` ← `GroupCard` (linhas 563–583), ramo "não participa", com:
  - `style="<%= zstyle(g.zone) %>"`; nome, descrição e local com `<%= %>`.
  - Título: `<a href="/grupos/<slug>">`.
  - Quando: `fmtDiasCurto(g.days) · fmtHora(g.start_time)`; Pace: `fmtFaixa(g.pace_min_s, g.pace_max_s)`; Participantes: `g.participants`.
  - "Entrar no grupo": **link** (não `button`) `<a class="btn btn-primary" href="/conta/entrar?next=/grupos/<slug>%23participar">` + `ic('plus','ico-sm')` + " Entrar no grupo" (fluxo de deslogado, `AGENTS.md` §5). Decidido pelo usuário: o destino responde 404 até o M5, e isso é aceito.
  - "Ver detalhes" → `/grupos/<slug>`; "Ver rota" → `/mapa/<slug>`.

### View — `src/views/pages/home.ejs`
Reproduz `PageHome` (linhas 596–651) com HTML, classes e textos idênticos, trocando:
| protótipo | aqui |
|---|---|
| `#grupos` | `/grupos` |
| `#encontrar` | `/encontrar` |
| `#zonas` | `/zonas` |
| `#cadastrar` | `/grupos/novo` |
| `#grupos-<z>` (zcard) | `/grupos?zona=<z>` |
| `${gs.length}` | `totalGroups` |
| faixa de pace | `fmtPace(paceMinS)–fmtPace(paceMaxS)` |
| `count(z)` | `countsByZone[z]`, com "grupo"/"grupos" igual ao protótipo |
| `DESTAQUES.map(GroupCard)` | `featured` → `partials/group-card` |
- Arte do hero (linhas 614–622): mesmo SVG; os loops (`r` 150…380, números 1–6 com `Math.cos/sin`, marcador amarelo) podem ser feitos em EJS ou pré-calculados, desde que os atributos gerados sejam **idênticos** aos do protótipo (mesmos números, formatação padrão de `Number#toString`).
- O `.notice` "Versão de demonstração" só aparece se `hasDemo`.
- Rótulo do 1º número do hero: "grupos cadastrados" (substitui "grupos no protótipo").
- Raia 1 de "Como funciona": manter literal, incluindo "Sem cadastro para começar."

## Regras e mensagens
| Elemento | Regra | Texto/valor exato (com os 11 grupos demo) |
|---|---|---|
| Hero eyebrow | fixo | "São Paulo · 5 zonas · grupos de corrida" |
| Hero stat 1 | `totalGroups` | **11** "grupos cadastrados" |
| Hero stat 2 | fixo | **5** "zonas da cidade" |
| Hero stat 3 | min `pace_min_s` – max `pace_max_s` | **4:00–8:30** "min/km de pace" |
| Zona Norte/Oeste/Centro/Leste | contagem | "2 grupos" |
| Zona Sul | contagem | "3 grupos" |
| Contagem = 1 | singular | "1 grupo" |
| Destaques | ordem `DESTAQUES` | Correria do Carmo, Pace da Oca, Pelotão Paulista |
| Card | etiqueta | "Fictício · demo" |
| Card Correria do Carmo | fatos | "Sáb · 6h30", "5:30–6:30 min/km", "48" |
| Card Pace da Oca | fatos | "Seg, Qua, Sex · 6h", "4:15–5:00 min/km", "56" |
| Card Pelotão Paulista | fatos | "Dom · 7h", "4:45–5:45 min/km", "72" |
| Notice | `hasDemo` | "**Versão de demonstração.** Os grupos exibidos são fictícios, em locais públicos reais da cidade, criados para mostrar como a plataforma funciona." |
| Raia 1 | fixo | "…seu nível. Sem cadastro para começar." (literal do protótipo) |
| Card | "Entrar no grupo" | `href="/conta/entrar?next=/grupos/<slug>%23participar"` (404 até o M5, aceito) |

Demais textos (lead, títulos de seção, "Como funciona", CTA): literais do protótipo.

## Critérios de aceite
- [ ] CA1 — Dado `npm run dev`, quando abro `/` ao lado de `docs/prototipo.html` (desktop, 360 px, claro e escuro), então a home é visualmente igual: hero com arte da pista animada, notice, 5 zonas com selos, 3 cards, 3 raias e faixa de CTA. **(Critério de pronto do M1.)**
- [ ] CA2 — Os números exibidos são os da tabela "Regras e mensagens" (11 "grupos cadastrados"; 5; 4:00–8:30; 2/2/2/2/3 grupos), e o texto "grupos no protótipo" não aparece.
- [ ] CA2b — A raia 1 de "Como funciona" mantém "Sem cadastro para começar."
- [ ] CA3 — Os cards em destaque aparecem na ordem Correria do Carmo → Pace da Oca → Pelotão Paulista, com a etiqueta "Fictício · demo" e os fatos da tabela.
- [ ] CA4 — Cada zcard leva a `/grupos?zona=<zona>`; cada card leva a `/grupos/<slug>`, `/mapa/<slug>` e "Entrar no grupo" a `/conta/entrar?next=/grupos/<slug>%23participar`. Não sobra nenhum `href="#..."` na página.
- [ ] CA5 — Os 5 selos têm `aria-label` "Selo da {Zona}, inspirado em {marco}" (ex.: "Selo da Zona Sul, inspirado em Oca do Ibirapuera").
- [ ] CA6 — Textos dos grupos são escapados (`<%= %>`); `<%- %>` só em partials, `ic`, `seal` e SVG fixo.
- [ ] CA7 — Funciona sem JS: a home renderiza completa e todos os links são `<a href>` reais (nenhum `button[data-act="entrar"]`).
- [ ] CA8 — Responsivo em 360 px: sem scroll horizontal (hero-art, zone-strip, cards, CTA).
- [ ] CA9 — `DEMO_GROUPS` tem os 11 grupos com os valores do `AGENTS.md` §7 e textos idênticos ao `DEMO` do protótipo.
- [ ] CA10 — Nada de SQL no projeto; `src/domain/` sem I/O; `npm test` e `npm run lint` passam.

## Testes esperados
- unit:
  - `tests/domain/pace.test.js`: `fmtPace(330)`=`"5:30"`, `fmtPace(240)`=`"4:00"`, `fmtPace(605)`=`"10:05"`; `fmtFaixa(330,390)`=`"5:30–6:30 min/km"`; `parsePace('5:30')`=330, `'3:00'`=180, `'12:00'`=720, `' 5:30 '`=330, `'2:59'`=null, `'12:01'`=null, `'5:60'`=null, `'530'`=null, `''`=null.
  - `tests/domain/schedule.test.js`: `fmtHora('06:30')`=`'6h30'`, `'07:00'`=`'7h'`, `'19:30'`=`'19h30'`; `fmtDiasCurto(['sex','seg','qua'])`=`'Seg, Qua, Sex'`; `fmtDiasCurto(['dom','sab'])`=`'Sáb, Dom'`; `sortDias` não muta a entrada.
  - `tests/domain/constants.test.js`: `ZONA_ORDEM` = `['norte','oeste','centro','leste','sul']`; cores/`on` de cada zona iguais ao `AGENTS.md` §6; todo slug de `DESTAQUES` existe em `DEMO_GROUPS`.
  - `tests/domain/demo-groups.test.js`: 11 grupos; slugs únicos; todos com `is_demo: true`; `pace_min_s < pace_max_s` e dentro de 180–720; `days ⊆ DIA_ORDEM` e não vazio; `level ∈ NIVEIS`; `zone ∈ ZONA_ORDEM`; `description` com 30–400 chars.
  - `tests/domain/pages-service.test.js`: `getHomeData()` → `totalGroups` 11, `paceMinS` 240, `paceMaxS` 510, `countsByZone` `{norte:2,oeste:2,centro:2,leste:2,sul:3}`, `featured` slugs na ordem de `DESTAQUES` com `participants` 48/56/72, `hasDemo` true; com lista vazia de demo (`is_demo:false`) → `hasDemo` false; slug de destaque ausente é ignorado.
  - `tests/domain/view-helpers.test.js` (acrescentar): `zstyle('centro')`=`'--z:#E8892B;--zon:#17171A'`; `seal('sul')` contém `aria-label="Selo da Zona Sul, inspirado em Oca do Ibirapuera"` e `width="64"`.
- http (`tests/http/home.test.js`): `GET /` → 200 e contém: "Encontre seu grupo.", `<strong>11</strong>grupos cadastrados` (e não contém "grupos no protótipo"), "Sem cadastro para começar.", `4:00–8:30`, 5 ocorrências de `class="zcard"`, `href="/grupos?zona=sul"`, "3 grupos", "Correria do Carmo" antes de "Pace da Oca" antes de "Pelotão Paulista", "Fictício · demo", "Versão de demonstração.", `href="/conta/entrar?next=/grupos/pace-da-oca%23participar"`, `href="/mapa/pelotao-paulista"`, `href="/grupos/novo"`; não contém `href="#`.

## Riscos / perguntas em aberto

### Perguntas em aberto
Resolvidas pelo usuário em 2026-11-11 (respostas já incorporadas em "Mudanças", "Regras e mensagens" e "Critérios de aceite"):
1. Rótulo da estatística do hero → "grupos cadastrados".
2. "Sem cadastro para começar." → manter.
3. "Entrar no grupo" nos cards → `/conta/entrar?next=/grupos/<slug>%23participar`; 404 até o M5 é aceito.

### Riscos / decisões técnicas tomadas
- Os dados demo ficam em `db/seeds/demo-groups.js` desde já (caminho previsto no `AGENTS.md` §3) para não duplicar o array no M2. O `src/` importa um arquivo de `db/seeds/` só até o M3, quando `pages.service` passa a usar o repo.
- A forma de `PACE_FAIXAS` diverge entre `AGENTS.md` §6 (`[min,max]`) e o protótipo (`{nome,min,max}`, o `nome` é usado nos selects de filtro). Não afeta o M1; precisa ser decidido na spec do M3.
- `start_time` fica como string `'HH:MM'` nos dados estáticos; no M3 o `pg` devolve `TIME` como `'HH:MM:SS'` — `fmtHora` deve continuar funcionando (ela só usa as duas primeiras partes; o teste do M3 deve cobrir `'06:30:00'`).
